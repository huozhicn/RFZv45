"""
如意 Agent Server — 独立 Mini LLM Agent
可接入任何消息源（SDB/企微/钉钉），只需实现消息获取+回写两个接口

架构:
  消息源 → agent.py → LLM（带 schema 上下文）→ 回写结果

配置: server/config.yaml（所有密钥/端点/模型外置）
提示词: server/prompts/*.md（改逻辑不碰代码）
"""
import asyncio
import json
import logging
import os
import re
import sys
from pathlib import Path

import yaml
from surrealdb import AsyncSurreal

ROOT = Path(__file__).resolve().parent
CONFIG_PATH = ROOT / "config.yaml"

# ── 配置加载 ──

def load_config() -> dict:
    with open(CONFIG_PATH) as f:
        cfg = yaml.safe_load(f)

    # 从环境变量读取密钥（优先级高于配置文件）
    cfg["llm"]["api_key"] = os.getenv("DEEPSEEK_API_KEY") or cfg["llm"]["api_key"]
    if not cfg["llm"]["api_key"]:
        raise RuntimeError("DEEPSEEK_API_KEY 未设置（环境变量或 config.yaml）")

    return cfg


CFG = load_config()
SDB = CFG["sdb"]
LLM = CFG["llm"]
PROMPTS = CFG["prompts"]
RT = CFG["runtime"]

PROMPTS_DIR = ROOT / PROMPTS["dir"]

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("ruyi-agent")


# ── 提示词 ──

def load_prompt(name: str) -> str:
    path = PROMPTS_DIR / name
    return path.read_text(encoding="utf-8") if path.exists() else ""


def build_system_prompt(user_role: str | None = None) -> str:
    from context import build_context
    parts = [
        load_prompt(PROMPTS["system"]),
        load_prompt(PROMPTS["actions"]),
        build_context(user_role),
    ]
    return "\n\n---\n\n".join(p for p in parts if p)


_prompt_cache: dict[str, str] = {}

def get_cached_prompt(role: str | None) -> str:
    key = role or "default"
    if key not in _prompt_cache:
        _prompt_cache[key] = build_system_prompt(role)
    return _prompt_cache[key]


# ── LLM ──

def _extract_actions(content: str) -> tuple[str, list]:
    """分离 LLM 回复中的文本和 actions JSON"""
    text, actions = content, []

    # 末尾 ```json [...] ```
    m = re.search(r"```(?:json)?\s*(\[[\s\S]*?\])\s*```\s*$", content)
    if m:
        try:
            actions = json.loads(m.group(1))
            text = content[: m.start()].strip()
            return text, actions
        except json.JSONDecodeError:
            pass

    # 末尾裸 JSON 数组
    m = re.search(r"(\[[\s\S]*?\])\s*$", content)
    if m:
        try:
            candidate = json.loads(m.group(1))
            if isinstance(candidate, list):
                return content[: m.start()].strip(), candidate
        except json.JSONDecodeError:
            pass

    return text, actions


async def call_llm(system_prompt: str, user_message: str) -> tuple[str, list]:
    """调 LLM，返回 (response_text, actions_list)"""
    import httpx

    headers = {
        "Authorization": f"Bearer {LLM['api_key']}",
        "Content-Type": "application/json",
    }
    body = {
        "model": LLM["model"],
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        "temperature": LLM.get("temperature", 0.3),
        "max_tokens": LLM.get("max_tokens", 2000),
    }

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{LLM['base_url']}/chat/completions",
            headers=headers,
            json=body,
        )
        resp.raise_for_status()
        data = resp.json()
        content = data["choices"][0]["message"]["content"]

    return _extract_actions(content)


# ── SDB ──

def _extract_rows(result) -> list:
    """SDB query 返回格式归一化"""
    if isinstance(result, list):
        if result and isinstance(result[0], dict) and "result" in result[0]:
            return result[0]["result"] or []
        if result and isinstance(result[0], list):
            return result[0]
        return result
    return []


async def get_user_info(db: AsyncSurreal, user_id: str) -> dict:
    try:
        result = await db.query(
            f"SELECT id, name, current_role, current_tenant FROM {user_id}"
        )
        rows = _extract_rows(result)
        return rows[0] if rows else {}
    except Exception as e:
        log.warning(f"获取用户信息失败: {e}")
    return {}


# ── 消息处理 ──

async def process_message(db: AsyncSurreal, msg: dict, sem: asyncio.Semaphore):
    async with sem:
        msg_id = msg["id"]
        user_input = msg.get("user_input", "") or ""
        created_by = str(msg.get("created_by", ""))

        log.info(f"处理 {msg_id}: {user_input[:80]}")

        try:
            # 1. 标记 processing
            await db.query(f"UPDATE {msg_id} SET status = 'processing';")

            # 2. 用户上下文
            user_ctx = await get_user_info(db, created_by) if created_by else {}
            role = user_ctx.get("current_role")

            # 3. LLM
            system_prompt = get_cached_prompt(role)
            response_text, actions = await call_llm(system_prompt, user_input)

            # 4. 回写
            await db.query(
                "UPDATE $msg_id SET response = $resp, actions = $acts, status = 'done', processed_at = time::now();",
                {"msg_id": msg_id, "resp": response_text, "acts": actions},
            )

            log.info(f"完成 {msg_id}")

        except Exception as e:
            log.error(f"处理 {msg_id} 失败: {e}")
            try:
                await db.query(
                    "UPDATE $msg_id SET response = $err, status = 'error', processed_at = time::now();",
                    {"msg_id": msg_id, "err": f"处理失败: {str(e)[:500]}"},
                )
            except Exception:
                log.error(f"连错误都写不进去: {msg_id}")


# ── 主循环 ──

async def main():
    log.info(f"如意 Agent Server 启动 | 模型: {LLM['model']} | 并发: {RT['max_concurrent']}")

    # 预热 prompt
    for role in [None, "平台管理员", "经理", "门店店长", "店员", "业务员"]:
        get_cached_prompt(role)
    log.info(f"提示词缓存就绪 ({len(_prompt_cache)} 个角色)")

    # 连接 SDB
    db = AsyncSurreal(SDB["url"])
    await db.connect()
    await db.signin({"user": SDB["username"], "pass": SDB["password"]})
    await db.use(SDB["namespace"], SDB["database"])
    log.info(f"SDB 已连接: {SDB['url']}")

    sem = asyncio.Semaphore(RT["max_concurrent"])

    # 积压处理
    result = await db.query(
        f"SELECT * FROM agent_message WHERE status = 'pending' ORDER BY created_at LIMIT {RT['backlog_limit']};"
    )
    backlog = _extract_rows(result)
    if backlog:
        log.info(f"积压消息: {len(backlog)} 条")
        tasks = [process_message(db, m, sem) for m in backlog if isinstance(m, dict)]
        if tasks:
            await asyncio.gather(*tasks)

    # LIVE SELECT
    try:
        live_id = await db.live(
            "LIVE SELECT * FROM agent_message WHERE status = 'pending'"
        )
        log.info(f"LIVE SELECT 注册: {live_id}")

        async def on_message(message: dict):
            data = message.get("result", message)
            if isinstance(data, dict) and data.get("status") == "pending":
                asyncio.create_task(process_message(db, data, sem))

        await db.subscribe_live(live_id, on_message)

    except Exception as e:
        log.warning(f"subscribe_live 失败 ({e})，回退轮询模式")
        while True:
            try:
                result = await db.query(
                    "SELECT * FROM agent_message WHERE status = 'pending' ORDER BY created_at LIMIT 5;"
                )
                for m in _extract_rows(result):
                    if isinstance(m, dict):
                        asyncio.create_task(process_message(db, m, sem))
            except Exception as e2:
                log.error(f"轮询错误: {e2}")
            await asyncio.sleep(RT["poll_fallback_seconds"])


if __name__ == "__main__":
    asyncio.run(main())
