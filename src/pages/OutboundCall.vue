<template>
  <div class="outbound-call-container">
    <!-- 左侧配置面板 -->
    <el-card class="config-panel">
      <template #header>
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px">
          <strong>SIP 配置</strong>
          <div>
            <el-button type="primary" :disabled="isRegistered" @click="handleRegister"
              >注册</el-button
            >
            <el-button :disabled="!isRegistered" @click="handleUnregister">注销</el-button>
            <el-button type="info" size="small" @click="diagnoseConnection">诊断</el-button>
          </div>
        </div>
      </template>

      <el-form label-position="top">
        <el-form-item label="SIP URI">
          <el-input v-model="form.uri" />
        </el-form-item>
        <el-form-item label="WebSocket 服务器">
          <el-input v-model="form.wsServers" />
        </el-form-item>
        <el-form-item label="认证用户">
          <el-input v-model="form.authUser" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" />
        </el-form-item>
        <el-form-item label="显示名称">
          <el-input v-model="form.displayName" />
        </el-form-item>
      </el-form>

      <div class="registration-status">
        <div :class="['status-indicator', isRegistered ? 'registered' : 'unregistered']"></div>
        <span>{{ isRegistered ? '已注册' : '未注册' }}</span>
      </div>
    </el-card>

    <!-- 右侧呼叫控制面板 -->
    <el-card class="call-control-panel">
      <template #header>
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px">
          <strong>呼叫控制</strong>
          <div class="call-status" v-if="isCalling && !hasIncomingCall">
            <span class="calling-indicator"></span>通话中
          </div>
          <div class="incoming-call-status" v-if="hasIncomingCall">
            <span class="incoming-indicator"></span>来电
          </div>
        </div>
      </template>

      <!-- 呼入电话处理区域 -->
      <div class="incoming-call-section" v-if="hasIncomingCall">
        <div class="incoming-call-info">
          <h3>🔔 来电</h3>
          <div class="caller-info">
            <p><strong>来电者:</strong> {{ incomingCallerInfo?.name || '未知' }}</p>
            <p><strong>号码:</strong> {{ incomingCallerInfo?.uri || '未知' }}</p>
          </div>
          <div class="incoming-call-buttons">
            <el-button type="success" @click="handleAcceptCall">接听</el-button>
            <el-button type="danger" @click="handleRejectCall">拒绝</el-button>
          </div>
        </div>
      </div>

      <div class="call-section">
        <div class="target-input">
          <span>被叫号码</span>
          <el-input v-model="target" placeholder="输入SIP URI" />
        </div>

        <div class="call-options">
          <div class="option-item">
            <span>无媒体模式</span>
            <el-switch
              v-model="useNoMediaMode"
              :disabled="isCalling"
              inactive-text="关闭"
              active-text="开启"
            />
            <small class="option-hint">开启后不获取麦克风权限，适用于信令测试</small>
          </div>
        </div>

        <div class="call-buttons">
          <el-button
            type="primary"
            :disabled="isCalling || isLoading"
            :loading="isLoading"
            @click="handleStartCall"
          >
            {{ isLoading ? '拨号中...' : '拨打电话' }}
          </el-button>
          <el-button type="danger" :disabled="!isCalling" @click="handleEndCall"> 挂断 </el-button>
        </div>
      </div>

      <div class="call-controls" v-if="isCalling">
        <el-button :disabled="!isCalling" @click="handleTransfer">转接</el-button>
        <el-button :disabled="!isCalling || isHeld" @click="handleHold">保持</el-button>
        <el-button :disabled="!isCalling || !isHeld" @click="handleUnhold">恢复</el-button>
        <el-button :disabled="!isCalling || isMuted" @click="handleMute">静音</el-button>
        <el-button :disabled="!isCalling || !isMuted" @click="handleUnmute">取消静音</el-button>
      </div>

      <div class="message-section">
        <div class="message-input">
          <span>消息内容</span>
          <el-input
            v-model="messageText"
            placeholder="输入消息内容"
            @keyup.enter="handleSendMessage"
          />
        </div>
        <el-button :disabled="!isRegistered" @click="handleSendMessage">发送消息</el-button>
      </div>

      <!-- 消息接收显示区域 -->
      <div class="received-messages-section" v-if="receivedMessages.length > 0">
        <h4>📨 接收的消息</h4>
        <div class="messages-list">
          <div v-for="message in receivedMessages" :key="message.id" class="message-item">
            <div class="message-header">
              <span class="message-from">{{ message.from }}</span>
              <span class="message-time">{{ formatTime(message.timestamp) }}</span>
            </div>
            <div class="message-content">{{ message.content }}</div>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'
import { ElInput, ElButton, ElCard, ElForm, ElFormItem, ElMessage, ElSwitch } from 'element-plus'
import { useJsSipClient } from '../composables/useJsSipClient'

type SipAuth = {
  uri: string
  wsServers: string
  authUser: string
  password: string
  displayName?: string
}

const form = ref<SipAuth>({
  uri: 'sip:5001@192.168.2.200',
  wsServers: 'ws://192.168.2.200:5066',
  authUser: '5001', //
  password: '1234',
  displayName: 'Web客户端',
})

const target = ref('sip:1413@192.168.2.200')

// 单呼控制：注册/拨号等
const {
  isRegistered,
  isCalling,
  isCallEstablished,
  isHeld,
  isMuted,
  hasIncomingCall,
  incomingCallerInfo,
  receivedMessages,
  register,
  unregister,
  makeCall,
  hangup,
  acceptIncomingCall,
  rejectIncomingCall,
  sendDtmf,
  hold,
  unhold,
  mute,
  unmute,
  transfer,
  sendMessage,
  diagnoseConnection,
} = useJsSipClient()

const messageText = ref('你好')
const isLoading = ref(false)
const useNoMediaMode = ref(false)

const ensureRegisteredThen = async (fn: () => Promise<void>) => {
  if (!isRegistered.value)
    await register({
      uri: form.value.uri,
      wsServers: form.value.wsServers,
      authUser: form.value.authUser,
      password: form.value.password,
      displayName: form.value.displayName,
    })
  await fn()
}

const handleRegister = async () => {
  try {
    ElMessage.info('正在注册SIP账户...')
    await register(form.value)
    ElMessage.success('SIP注册成功！')
  } catch (error) {
    console.error('SIP注册失败:', error)
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    ElMessage.error(`SIP注册失败: ${errorMessage}`)
  }
}
const handleUnregister = async () => {
  try {
    ElMessage.info('正在注销SIP账户...')
    await unregister()
    ElMessage.success('SIP注销成功！')
  } catch (error) {
    console.error('SIP注销失败:', error)
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    ElMessage.warning(`SIP注销失败: ${errorMessage}`)
  }
}
const handleStartCall = async () => {
  if (isLoading.value) return

  isLoading.value = true
  try {
    ElMessage.info('正在拨打电话...')
    const callOptions = useNoMediaMode.value
      ? { audio: false, video: false, inviteWithoutSdp: true }
      : { audio: true, video: false }

    await ensureRegisteredThen(() => makeCall(target.value, callOptions))
    ElMessage.success('拨号成功，等待接听...')

    // 设置超时检测通话是否建立
    setTimeout(() => {
      if (isCalling.value && !isCallEstablished.value) {
        console.log('通话超时，可能被拒绝或无法接通')
        ElMessage.warning('通话超时，请检查被叫号码或网络连接')
      }
    }, 10000) // 10秒超时
  } catch (error) {
    console.error('拨打电话失败:', error)
    ElMessage.error(`拨打电话失败: ${error instanceof Error ? error.message : '未知错误'}`)
    isCalling.value = false
  } finally {
    isLoading.value = false
  }
}
const handleEndCall = () => hangup()
const handleTransfer = () => transfer(target.value)
const handleHold = () => hold()
const handleUnhold = () => unhold()
const handleMute = () => mute()
const handleUnmute = () => unmute()
const handleSendMessage = async () => {
  try {
    await sendMessage(target.value, messageText.value)
    ElMessage.success('消息发送成功')
  } catch (error) {
    console.error('发送消息失败:', error)
    ElMessage.error(`发送消息失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

const handleAcceptCall = async () => {
  try {
    await acceptIncomingCall({ audio: true, video: false })
    ElMessage.success('已接听来电')
  } catch (error) {
    console.error('接听来电失败:', error)
    ElMessage.error(`接听来电失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

const handleRejectCall = async () => {
  try {
    await rejectIncomingCall()
    ElMessage.info('已拒绝来电')
  } catch (error) {
    console.error('拒绝来电失败:', error)
    ElMessage.error(`拒绝来电失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

const formatTime = (date: Date) => {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const handleSendDtmf = (tone: string) => sendDtmf(tone)

onBeforeUnmount(() => {
  unregister().catch(() => {})
})
</script>

<style scoped>
.outbound-call-container {
  display: flex;
  gap: 20px;
}

.config-panel {
  width: 40%;
}

.call-control-panel {
  width: 60%;
}

.registration-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
}

.status-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.registered {
  background-color: #67c23a;
}

.unregistered {
  background-color: #f56c6c;
}

.call-section {
  margin-bottom: 20px;
}

.target-input {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.call-options {
  margin-bottom: 16px;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.option-hint {
  color: #909399;
  font-size: 12px;
  margin-left: auto;
}

.call-buttons {
  display: flex;
  gap: 12px;
}

.call-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 20px;
}

.message-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message-input {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;
}

.call-status {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #409eff;
}

.calling-indicator {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: #409eff;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
  100% {
    opacity: 1;
  }
}

/* 呼入电话样式 */
.incoming-call-section {
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border: 2px solid #0ea5e9;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
  animation: glow 2s infinite;
}

.incoming-call-info h3 {
  margin: 0 0 12px 0;
  color: #0369a1;
  font-size: 18px;
}

.caller-info {
  margin-bottom: 16px;
}

.caller-info p {
  margin: 4px 0;
  color: #374151;
}

.incoming-call-buttons {
  display: flex;
  gap: 12px;
}

.incoming-call-status {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #0ea5e9;
  font-weight: 600;
}

.incoming-indicator {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: #0ea5e9;
  animation: pulse 1s infinite;
}

@keyframes glow {
  0%,
  100% {
    box-shadow: 0 0 5px rgba(14, 165, 233, 0.3);
  }
  50% {
    box-shadow: 0 0 20px rgba(14, 165, 233, 0.6);
  }
}

/* 消息接收样式 */
.received-messages-section {
  margin-top: 20px;
  border-top: 1px solid #e5e7eb;
  padding-top: 16px;
}

.received-messages-section h4 {
  margin: 0 0 12px 0;
  color: #374151;
  font-size: 16px;
}

.messages-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #f9fafb;
}

.message-item {
  padding: 12px;
  border-bottom: 1px solid #e5e7eb;
  transition: background-color 0.2s;
}

.message-item:last-child {
  border-bottom: none;
}

.message-item:hover {
  background: #f3f4f6;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.message-from {
  font-weight: 600;
  color: #374151;
  font-size: 14px;
}

.message-time {
  font-size: 12px;
  color: #6b7280;
}

.message-content {
  color: #4b5563;
  font-size: 14px;
  line-height: 1.4;
  word-wrap: break-word;
}
</style>
