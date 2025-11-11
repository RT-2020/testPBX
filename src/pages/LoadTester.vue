<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElButton,
  ElCard,
  ElSwitch,
  ElDivider,
  ElAlert,
  ElSpace,
  ElTag,
  ElProgress,
} from 'element-plus'
import { useJsSipLoadTester } from '@/composables/useJsSipLoadTester'

type SipAuth = {
  uri: string
  wsServers: string
  authUser: string
  password: string
  displayName?: string
}

const form = ref<SipAuth>({
  uri: 'sip:2001@192.168.2.200',
  wsServers: 'wss://192.168.2.200:7443',
  authUser: '2001',
  password: '1234',
  displayName: 'Load Bot',
})

const target = ref('sip:2002@192.168.2.200')
const concurrent = ref(10)
const callSeconds = ref(15)
const autoHangup = ref(true)

const {
  isRunning,
  startedAt,
  numActiveCalls,
  numSucceeded,
  numFailed,
  totalAttempts,
  progress,
  startLoad,
  stopLoad,
} = useJsSipLoadTester()

const canStart = computed(() => !isRunning.value && concurrent.value > 0)

const handleStart = () => {
  startLoad({
    auth: form.value,
    target: target.value,
    concurrent: concurrent.value,
    callSeconds: callSeconds.value,
    autoHangup: autoHangup.value,
  })
}

const handleStop = () => stopLoad()
</script>

<template>
  <el-card>
    <template #header>
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px">
        <strong>并发通话压测</strong>
        <div>
          <el-button type="primary" :disabled="!canStart" @click="handleStart">开始压测</el-button>
          <el-button :disabled="!isRunning" @click="handleStop">停止</el-button>
        </div>
      </div>
    </template>

    <el-form label-width="120px">
      <el-form-item label="SIP URI">
        <el-input v-model="form.uri" placeholder="sip:2001@domain" />
      </el-form-item>
      <el-form-item label="WebSocket(WSS)">
        <el-input v-model="form.wsServers" placeholder="wss://ip:7443" />
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
      <el-form-item label="并发数">
        <el-input-number v-model="concurrent" :min="1" :max="500" />
      </el-form-item>
      <el-form-item label="通话时长(秒)">
        <el-input-number v-model="callSeconds" :min="5" :max="600" />
      </el-form-item>
      <el-form-item label="自动挂断">
        <el-switch v-model="autoHangup" />
      </el-form-item>
    </el-form>

    <el-divider />

    <el-space wrap>
      <el-tag type="success">成功: {{ numSucceeded }}</el-tag>
      <el-tag type="danger">失败: {{ numFailed }}</el-tag>
      <el-tag>进行中: {{ numActiveCalls }}</el-tag>
      <el-tag>总尝试: {{ totalAttempts }}</el-tag>
    </el-space>
    <div style="margin-top: 12px">
      <el-progress :percentage="progress" />
    </div>
    <el-alert v-if="isRunning" type="info" :closable="false" style="margin-top: 12px">
      已开始: {{ new Date(startedAt || 0).toLocaleString() }}
    </el-alert>
  </el-card>
</template>

<style scoped></style>
