<script setup lang="ts">
import { ref } from 'vue'
import { NCard, NForm, NFormItem, NInput, NButton, NSpace, useMessage } from 'naive-ui'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const message = useMessage()

const username = ref('')
const password = ref('')
const loading = ref(false)

async function handleLogin() {
  if (!username.value || !password.value) {
    message.warning('请输入用户名和密码')
    return
  }
  loading.value = true
  try {
    await auth.login(username.value, password.value)
    message.success('登录成功')
  } catch (err: any) {
    message.error(err.message || '登录失败')
  } finally {
    loading.value = false
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') handleLogin()
}
</script>

<template>
  <div class="login-wrapper">
    <n-card title="RFZv45 如法造" style="width: 380px" :bordered="false">
      <template #header-extra>
        <span style="color: #999; font-size: 13px">Admin</span>
      </template>

      <n-form label-placement="left" label-width="72">
        <n-form-item label="用户名">
          <n-input
            v-model:value="username"
            placeholder="输入用户名"
            @keydown="handleKeydown"
          />
        </n-form-item>
        <n-form-item label="密码">
          <n-input
            v-model:value="password"
            type="password"
            placeholder="输入密码"
            @keydown="handleKeydown"
          />
        </n-form-item>
      </n-form>

      <n-space justify="end">
        <n-button
          type="primary"
          :loading="loading"
          :disabled="!username || !password"
          @click="handleLogin"
        >
          登录
        </n-button>
      </n-space>
    </n-card>
  </div>
</template>

<style scoped>
.login-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: #f0f2f5;
}
</style>
