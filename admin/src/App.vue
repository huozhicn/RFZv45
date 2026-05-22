<script setup lang="ts">
/**
 * App.vue — v45 Admin · ChatGPT 风格布局
 */
import { ref } from 'vue'
import { NLayout, NLayoutSider, NLayoutContent, NButton, NInput, NMessageProvider } from 'naive-ui'
import LoginView from '@/views/LoginView.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const collapsed = ref(false)
const inputText = ref('')
const version = __COMMIT_HASH__
</script>

<template>
  <n-message-provider>
    <LoginView v-if="!auth.isAuthenticated" />

    <n-layout v-else style="height: 100vh" has-sider>
      <n-layout-sider
        bordered
        collapse-mode="width"
        :collapsed-width="0"
        :width="220"
        :collapsed="collapsed"
        show-trigger="bar"
      >
        <div style="padding:16px;font-weight:700">RFZv45</div>
        <div style="position:absolute;bottom:12px;left:16px;color:#aaa;font-size:11px;font-family:monospace">
          v.{{ version }}
        </div>
      </n-layout-sider>

      <n-layout>
        <n-layout-content>
          <div style="display:flex;flex-direction:column;height:100%">
          <div style="flex:1;padding:40px 24px;text-align:center;color:#999;overflow-y:auto">
            <div style="font-size:48px;margin-bottom:16px">💬</div>
            <div style="font-size:18px;font-weight:600;color:#666">对话即操作</div>
            <div style="font-size:14px;margin-top:8px">在下方输入指令</div>
          </div>

          <div style="border-top:1px solid #e0e0e0;padding:12px 24px;background:#fff;display:flex;gap:8px;align-items:flex-end;flex-shrink:0">
            <n-input
              v-model:value="inputText"
              type="textarea"
              placeholder="输入指令... (Enter 发送)"
              :autosize="{ minRows: 1, maxRows: 4 }"
              style="flex:1"
              size="large"
              round
            />
            <n-button type="primary" size="large" style="border-radius:20px;min-width:80px">发送</n-button>
          </div>
          </div>
        </n-layout-content>
      </n-layout>
    </n-layout>
  </n-message-provider>
</template>
