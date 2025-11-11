<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ElForm, ElFormItem, ElInput, ElButton, ElCard, ElSwitch, ElDivider } from 'element-plus'
import { useJsSipClient } from '../composables/useJsSipClient'

type SipAuth = {
  uri: string
  wsServers: string
  authUser: string
  password: string
  displayName?: string
}

const form = ref<SipAuth>({
  uri: 'sip:1000@127.0.0.1',
  wsServers: 'wss://127.0.0.1:7443',
  authUser: '1000',
  password: '1234',
  displayName: 'Web Client',
})

const target = ref('sip:1001@127.0.0.1')

const localVideoRef = ref<HTMLVideoElement | null>(null)
const remoteVideoRef = ref<HTMLVideoElement | null>(null)

const { isRegistered, isCalling, register, unregister, makeCall, hangup, attachVideoElements } =
  useJsSipClient()

onMounted(() => attachVideoElements({ local: localVideoRef, remote: remoteVideoRef }))
onBeforeUnmount(() => unregister())

const handleRegister = () => register(form.value)
const handleCall = () => makeCall(target.value, { audio: true, video: true })
const handleHangup = () => hangup()
</script>

<template>
  <el-card>
    <template #header>
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px">
        <strong>视频呼叫</strong>
        <div>
          <el-button type="primary" :disabled="isRegistered" @click="handleRegister"
            >注册</el-button
          >
          <el-button :disabled="!isCalling" @click="handleHangup">挂断</el-button>
        </div>
      </div>
    </template>

    <el-form label-width="120px">
      <el-form-item label="SIP URI">
        <el-input v-model="form.uri" />
      </el-form-item>
      <el-form-item label="WebSocket(WSS)">
        <el-input v-model="form.wsServers" />
      </el-form-item>
      <el-form-item label="用户名">
        <el-input v-model="form.authUser" />
      </el-form-item>
      <el-form-item label="密码">
        <el-input v-model="form.password" type="password" />
      </el-form-item>
      <el-form-item label="显示名">
        <el-input v-model="form.displayName" />
      </el-form-item>
      <el-divider />
      <el-form-item label="被叫URI">
        <el-input v-model="target" />
      </el-form-item>
      <el-form-item>
        <el-button type="success" :disabled="!isRegistered" @click="handleCall">拨号</el-button>
      </el-form-item>
    </el-form>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px">
      <video
        ref="localVideoRef"
        autoplay
        playsinline
        muted
        style="background: #000; height: 240px"
      />
      <video ref="remoteVideoRef" autoplay playsinline style="background: #000; height: 240px" />
    </div>
  </el-card>
</template>

<style scoped></style>
