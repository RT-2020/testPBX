<template>
  <div class="outbound-call-container">
    <!-- 左侧配置面板 -->
    <el-card class="config-panel">
      <template #header>
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px">
          <strong>SIPml5 配置</strong>
          <div>
            <el-button type="primary" :disabled="isRegistered" @click="handleRegister"
              >注册</el-button
            >
            <el-button :disabled="!isRegistered" @click="handleUnregister">注销</el-button>
            <el-button type="info" size="small" @click="handleDiagnose">诊断</el-button>
          </div>
        </div>
      </template>

      <el-form label-position="top">
        <el-form-item label="SIP URI">
          <el-input v-model="form.uri" />
        </el-form-item>
        <el-form-item label="Realm/Domain">
          <el-input v-model="form.realm" placeholder="例如：192.168.2.200 或 pbx.example.com" />
        </el-form-item>
        <el-form-item label="WebSocket 服务器">
          <el-input v-model="form.wsServers" />
        </el-form-item>
        <el-form-item label="Outbound Proxy（可选）">
          <el-input
            v-model="form.outboundProxy"
            placeholder="例如：udp://192.168.2.200:5060 或 sip:domain"
          />
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

      <audio ref="audioRemote" autoplay playsinline style="display: none"></audio>
    </el-card>

    <!-- 右侧呼叫控制面板 -->
    <el-card class="call-control-panel">
      <template #header>
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px">
          <strong>呼叫控制（SIPml5）</strong>
          <div class="call-status" v-if="isCalling && !hasIncomingCall">
            <span class="calling-indicator"></span>{{ callStatus || '通话中' }}
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
          <el-input v-model="target" placeholder="输入SIP URI 或 号码" />
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
        <el-button :disabled="!isCalling || isHeld" @click="handleHold">保持</el-button>
        <el-button :disabled="!isCalling || !isHeld" @click="handleUnhold">恢复</el-button>
        <el-button :disabled="!isCalling || isMuted" @click="handleMute">静音</el-button>
        <el-button :disabled="!isCalling || !isMuted" @click="handleUnmute">取消静音</el-button>
      </div>

      <div class="dialpad" v-if="isCalling">
        <div class="digits">
          <button class="digit" v-for="d in dialDigits" :key="d" @click="() => handleSendDtmf(d)">
            {{ d }}
          </button>
        </div>
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
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ElInput, ElButton, ElCard, ElForm, ElFormItem, ElMessage } from 'element-plus'

type SipAuth = {
  uri: string
  realm?: string
  wsServers: string
  outboundProxy?: string
  authUser: string
  password: string
  displayName?: string
}

const form = ref<SipAuth>({
  uri: 'sip:5001@192.168.2.200',
  realm: '192.168.2.200',
  wsServers: 'ws://192.168.2.200:5066',
  outboundProxy: '',
  authUser: '5001',
  password: '1234',
  displayName: 'SIPml5-Client',
})

const target = ref('sip:1413@192.168.2.200')

const isRegistered = ref(false)
const isCalling = ref(false)
const isCallEstablished = ref(false)
const isHeld = ref(false)
const isMuted = ref(false)
const hasIncomingCall = ref(false)
const incomingCallerInfo = ref<{ name?: string; uri?: string } | null>(null)
const isLoading = ref(false)
const callStatus = ref('') // 添加呼叫状态显示
const messageText = ref('你好')
type ReceivedMessage = { id: string; from: string; content: string; timestamp: Date }
const receivedMessages = ref<ReceivedMessage[]>([])

const audioRemote = ref<HTMLAudioElement | null>(null)
const dialDigits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#']

let sipStack: any | null = null
let sipSessionRegister: any | null = null
let sipSessionCall: any | null = null
let sipmlInitialized = false

const getSIPml = (): any | null => (window as any).SIPml || null

const parseRealmFromUri = (uri: string): string | null => {
  const match = uri.match(/sip:[^@]+@([^;>]+)/)
  return match?.[1] ?? null
}

const extractHostFromWsUrl = (wsUrl: string): string | null => {
  try {
    if (!wsUrl) return null
    const u = new URL(wsUrl)
    return u.hostname || null
  } catch {
    const m = wsUrl.match(/^(?:wss?:\/\/)?([^:\/]+)/i)
    return m?.[1] ?? null
  }
}

const getNormalizedRealm = (): string => {
  const explicit = form.value.realm?.trim()
  if (explicit) return explicit
  const fromUri = parseRealmFromUri(form.value.uri)
  if (fromUri) return fromUri
  const fromWs = extractHostFromWsUrl(form.value.wsServers)
  if (fromWs) return fromWs
  throw new Error('无法解析 Realm，请在表单中填写或提供有效的 SIP URI/WS 地址')
}

const getNormalizedImpu = (realm: string): string => {
  const raw = (form.value.uri || '').trim()
  if (/^sip:/i.test(raw)) return raw
  if (!form.value.authUser) throw new Error('缺少认证用户，用于构造 IMPU')
  return `sip:${form.value.authUser}@${realm}`
}

const sanitizeDisplayName = (displayName?: string): string => {
  if (!displayName) return 'SIPml5-Client'
  // 移除非 ASCII 字符，替换为安全的字符
  return displayName.replace(/[^\x20-\x7E]/g, '').trim() || 'SIPml5-Client'
}

const normalizeTargetToSipUri = (dest: string): string => {
  const realm = getNormalizedRealm()
  return /^sip:/i.test(dest) ? dest : `sip:${dest}@${realm}`
}

const sipInit = async () => {
  if (sipmlInitialized) {
    console.log('SIPml5 已经初始化，跳过')
    return
  }

  const SIPml = getSIPml()
  if (!SIPml) {
    console.error('SIPml5 对象未找到，请检查脚本加载')
    throw new Error('SIPml5 脚本未加载')
  }

  console.log('开始初始化 SIPml5...')
  console.log('SIPml5 对象:', SIPml)

  // 参考官方 demo：先初始化再检测环境
  console.log('调用 SIPml.init()...')
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      console.error('SIPml5 初始化超时')
      reject(new Error('SIPml5 初始化超时'))
    }, 10000)

    try {
      SIPml.init(
        () => {
          clearTimeout(timeout)
          console.log('✅ SIPml5 初始化成功回调被调用')
          sipmlInitialized = true

          // 初始化成功后进行环境检测
          try {
            console.log('🔍 开始环境检测...')

            if (!SIPml.isWebSocketSupported()) {
              console.error('❌ WebSocket 不支持')
              reject(new Error('浏览器不支持 WebSocket'))
              return
            }
            console.log('✅ WebSocket 支持检测通过')

            if (!SIPml.isWebRtcSupported()) {
              console.warn('⚠️ WebRTC 不支持，音视频功能不可用')
            } else {
              console.log('✅ WebRTC 支持检测通过')
            }

            console.log('✅ 环境检测完成')
          } catch (envErr) {
            console.error('❌ 环境检测失败:', envErr)
            reject(envErr)
            return
          }

          // 设置调试级别
          try {
            SIPml.setDebugLevel('info')
            console.log('✅ SIPml5 调试级别设置为 info')
          } catch (err) {
            console.warn('⚠️ 设置调试级别失败:', err)
          }

          resolve()
        },
        (error: any) => {
          clearTimeout(timeout)
          console.error('❌ SIPml5 初始化失败回调被调用:', error)
          const errorMsg = error?.message || error?.description || String(error)
          reject(new Error(`SIPml5 初始化失败: ${errorMsg}`))
        },
      )
      console.log('SIPml.init() 调用完成，等待回调...')
    } catch (err) {
      clearTimeout(timeout)
      console.error('❌ SIPml.init() 调用异常:', err)
      reject(err as Error)
    }
  })
}

const createStack = async () => {
  console.log('🔧 开始创建 SIP Stack...')

  const SIPml = getSIPml()
  if (!SIPml) {
    console.error('❌ SIPml5 对象未找到')
    throw new Error('SIPml5 脚本未加载')
  }

  if (!sipmlInitialized) {
    console.error('❌ SIPml5 尚未初始化')
    throw new Error('SIPml5 尚未初始化，请先调用 sipInit()')
  }

  console.log('✅ SIPml5 初始化状态验证通过')

  const realm = getNormalizedRealm()
  const impu = getNormalizedImpu(realm)
  const displayName = sanitizeDisplayName(form.value.displayName)

  console.log('📋 Stack 配置参数:', {
    realm,
    impi: form.value.authUser,
    impu,
    display_name: displayName,
    websocket_proxy_url: form.value.wsServers,
    outbound_proxy_url: form.value.outboundProxy || undefined,
  })

  try {
    console.log('🏗️ 创建 SIPml.Stack 实例...')
    sipStack = new SIPml.Stack({
      realm,
      impi: form.value.authUser,
      impu,
      password: form.value.password,
      display_name: displayName,
      websocket_proxy_url: form.value.wsServers,
      outbound_proxy_url: form.value.outboundProxy || undefined,
      // 优化配置以减少呼叫延迟
      enable_rtcweb_breaker: true, // 启用WebRTC断路器以改善连接
      enable_early_ims: true, // 启用早期IMS支持
      enable_media_stream_cache: true, // 启用媒体流缓存
      enable_click2call: false,
      // ICE服务器配置 - 添加更多STUN服务器并优化顺序
      ice_servers: [
        { url: 'stun:stun.l.google.com:19302' },
        { url: 'stun:stun1.l.google.com:19302' },
        { url: 'stun:stun2.l.google.com:19302' },
        { url: 'stun:stun.counterpath.net:3478' },
        { url: 'stun:numb.viagenie.ca:3478' },
      ],
      // WebRTC配置优化
      bandwidth: { audio: 64, video: 0 }, // 限制音频带宽，禁用视频
      video_size: { minWidth: 0, minHeight: 0, maxWidth: 0, maxHeight: 0 },
      events_listener: { events: '*', listener: onSipEventStack },
      sip_headers: [
        { name: 'User-Agent', value: 'WebRTC-SIPml5/1.0 (Optimized)' },
        { name: 'Organization', value: 'WebRTC Client' },
        // 添加支持早期媒体的头部
        { name: 'Supported', value: '100rel,timer,replaces,norefersub' },
        {
          name: 'Allow',
          value: 'INVITE,ACK,CANCEL,BYE,NOTIFY,REFER,MESSAGE,OPTIONS,INFO,SUBSCRIBE',
        },
      ],
    })
    console.log('✅ SIPml.Stack 实例创建成功')
  } catch (err) {
    console.error('❌ 创建 SIPml.Stack 失败:', err)
    throw new Error(`创建 SIP 栈失败: ${err instanceof Error ? err.message : String(err)}`)
  }

  // 按照官方文档：start 后通过 'started' 事件回调进行注册
  try {
    console.log('🚀 启动 SIP Stack...')
    const result = sipStack.start()
    console.log('📞 SIP Stack start() 返回值:', result)
    if (result !== 0) {
      throw new Error(`SIP 栈启动失败，返回码: ${result}`)
    }
    console.log('✅ SIP Stack 启动成功，等待 started 事件...')
  } catch (err) {
    console.error('❌ SIP Stack 启动异常:', err)
    throw new Error(`SIP 栈启动失败: ${err instanceof Error ? err.message : String(err)}`)
  }
}

const onSipEventStack = (e: any) => {
  console.log('📡 SIP Stack 事件:', e.type, e)

  switch (e.type) {
    case 'started':
      console.log('✅ SIP Stack 已启动，开始注册...')
      // 自动注册
      doRegister()
      break
    case 'stopping':
    case 'stopped':
      console.log('🛑 SIP Stack 已停止')
      isRegistered.value = false
      break
    case 'failed_to_start':
      console.error('❌ SIP Stack 启动失败:', e.description)
      isRegistered.value = false
      break
    case 'failed_to_stop':
      console.error('❌ SIP Stack 停止失败:', e.description)
      isRegistered.value = false
      break
    case 'i_new_call': {
      sipSessionCall = e.newSession
      if (sipSessionCall) {
        sipSessionCall.setConfiguration({
          events_listener: { events: '*', listener: onSipEventCall },
        })
        hasIncomingCall.value = true
        const fromUri: string = e?.newSession?.getRemoteFriendlyName?.() || ''
        incomingCallerInfo.value = { name: fromUri, uri: fromUri }
      }
      break
    }
    case 'i_new_message': {
      try {
        const from: string =
          e?.getFromUri?.() || e?.newSession?.getRemoteFriendlyName?.() || '未知来源'
        const content: string = e?.getContentString?.() || e?.getContent?.() || ''
        receivedMessages.value.unshift({
          id: `${Date.now()}-${Math.random()}`,
          from,
          content,
          timestamp: new Date(),
        })
      } catch {}
      break
    }
  }
}

const onSipEventRegister = (e: any) => {
  console.log('📞 注册事件:', e.type, e)

  if (e.type === 'connected' || e.type === 'registered') {
    console.log('✅ 注册成功!')
    isRegistered.value = true
    ElMessage.success('注册成功')
  } else if (e.type === 'terminated' || e.type === 'unregistered' || e.type === 'failed') {
    const code = e?.getSipResponseCode?.() ?? e?.code
    const desc = e?.description || '未知错误'
    console.error(`❌ 注册失败(${code}): ${desc}`)
    isRegistered.value = false
    ElMessage.error(`注册失败${code ? `(${code})` : ''}: ${desc}`)
  } else {
    console.log(`📞 注册事件 ${e.type}:`, e.description || '')
  }
}

const onSipEventCall = (e: any) => {
  console.log('📞 通话事件:', e.type, e.description || '', e)

  switch (e.type) {
    case 'connecting':
      console.log('📞 通话连接中...')
      isCalling.value = true
      callStatus.value = '正在连接...'
      ElMessage.info('正在连接通话...')
      break
    case 'ringing':
      console.log('📞 对方振铃中...')
      callStatus.value = '对方振铃中...'
      ElMessage.info('对方振铃中，请等待接听...')
      break
    case 'connected':
      console.log('✅ 通话已建立')
      isCalling.value = true
      isCallEstablished.value = true
      callStatus.value = '通话中'
      ElMessage.success('通话已接通')
      break
    case 'terminating':
      console.log('📞 通话终止中...')
      ElMessage.info('正在挂断通话...')
      break
    case 'terminated':
      console.log('📞 通话已终止:', e.description)
      isCalling.value = false
      isCallEstablished.value = false
      isMuted.value = false
      isHeld.value = false
      hasIncomingCall.value = false
      incomingCallerInfo.value = null
      callStatus.value = ''
      sipSessionCall = null
      ElMessage.info('通话已结束')
      break
    case 'm_local_hold_ok':
    case 'local_hold_ok':
      console.log('📞 通话已保持')
      isHeld.value = true
      ElMessage.success('通话已保持')
      break
    case 'm_local_resume_ok':
    case 'local_resume_ok':
      console.log('📞 通话已恢复')
      isHeld.value = false
      ElMessage.success('通话已恢复')
      break
    case 'm_local_mute_ok':
      console.log('🔇 通话已静音')
      isMuted.value = true
      ElMessage.success('已静音')
      break
    case 'm_local_unmute_ok':
      console.log('🔊 通话已取消静音')
      isMuted.value = false
      ElMessage.success('已取消静音')
      break
    case 'i_ao_request': {
      const responseCode = e.getSipResponseCode?.()
      console.log('📞 收到SIP响应:', responseCode)
      // 180 Ringing - 对方振铃
      if (responseCode === 180) {
        callStatus.value = '对方振铃中...'
        ElMessage.info('📞 对方电话振铃中...')
      }
      // 183 Session Progress - 会话进展（可能包含早期媒体）
      else if (responseCode === 183) {
        callStatus.value = '会话进展中...'
        ElMessage.info('📞 呼叫进展中...')
      }
      // 100 Trying - 尝试中
      else if (responseCode === 100) {
        callStatus.value = '尝试连接中...'
      }
      break
    }
    case 'm_early_media':
      console.log('📞 早期媒体开始')
      ElMessage.info('🎵 收到回铃音')
      break
    case 'm_stream_audio_local_added':
      console.log('🎤 本地音频流已添加')
      break
    case 'm_stream_audio_local_removed':
      console.log('🎤 本地音频流已移除')
      break
    case 'm_stream_audio_remote_added':
      console.log('🔊 远程音频流已添加')
      // 远程音频流添加时，确保音频元素正确配置
      if (audioRemote.value && e.stream) {
        audioRemote.value.srcObject = e.stream
        audioRemote.value.play().catch(console.error)
      }
      break
    case 'm_stream_audio_remote_removed':
      console.log('🔊 远程音频流已移除')
      break
    case 'failed': {
      const code = e.getSipResponseCode?.()
      const reason = e.description || '未知错误'
      console.error('❌ 通话失败:', code, reason)
      ElMessage.error(`通话失败${code ? ` (${code})` : ''}: ${reason}`)
      // 重置状态
      isCalling.value = false
      isCallEstablished.value = false
      sipSessionCall = null
      break
    }
    default:
      console.log('📞 其他通话事件:', e.type, e.description)
      break
  }
}

const doRegister = () => {
  console.log('📝 开始注册流程...')

  if (!sipStack) {
    console.error('❌ SIP Stack 未创建')
    return
  }

  try {
    console.log('🔧 创建注册会话...')
    sipSessionRegister = sipStack.newSession('register', {
      expires: 200,
      events_listener: { events: '*', listener: onSipEventRegister },
      sip_caps: [
        { name: '+g.oma.sip-im', value: null },
        { name: '+audio', value: null },
        { name: 'language', value: '"en,fr"' },
      ],
    })
    console.log('✅ 注册会话创建成功')

    console.log('📡 发送注册请求...')
    const result = sipSessionRegister.register()
    console.log('📤 注册请求返回值:', result)

    if (result !== 0) {
      console.error('❌ 注册请求发送失败，返回码:', result)
    }
  } catch (err) {
    console.error('❌ 注册过程异常:', err)
  }
}

const register = async () => {
  try {
    if (!getSIPml()) throw new Error('SIPml5 未加载')
    await sipInit()
    await createStack()
  } catch (error) {
    throw error
  }
}

const unregister = async () => {
  try {
    if (sipSessionRegister) sipSessionRegister.unregister()
    if (sipStack) sipStack.stop()
  } finally {
    isRegistered.value = false
    sipStack = null
    sipSessionRegister = null
    sipSessionCall = null
    // 不重置 sipmlInitialized，因为 SIPml 引擎可以复用
  }
}

const ensureRegisteredThen = async (fn: () => Promise<void>) => {
  if (!isRegistered.value) await register()
  await fn()
}

const makeCall = async (dest: string) => {
  console.log('📞 开始拨打电话:', dest)

  const SIPml = getSIPml()
  if (!SIPml) throw new Error('SIPml5 未加载')
  if (!sipStack) throw new Error('SIP 栈未启动')

  const targetUri = normalizeTargetToSipUri(dest)
  console.log('📞 目标 URI:', targetUri)

  try {
    console.log('🔧 创建音频通话会话...')
    sipSessionCall = sipStack.newSession('call-audio', {
      audio_remote: audioRemote.value,
      video_local: null,
      video_remote: null,
      // 优化带宽配置以加速媒体协商
      bandwidth: { audio: 64, video: 0 },
      video_size: { minWidth: 0, minHeight: 0, maxWidth: 0, maxHeight: 0 },
      events_listener: { events: '*', listener: onSipEventCall },
      // 优化SIP能力声明
      sip_caps: [
        { name: '+g.oma.sip-im', value: null },
        { name: '+audio', value: null },
        { name: 'language', value: '"en,fr"' },
      ],
      // 添加媒体约束以加速协商
      media_constraints: {
        audio: true,
        video: false,
      },
      // RTC配置优化
      rtc_configuration: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
      },
    })
    console.log('✅ 音频通话会话创建成功')

    console.log('📡 发起呼叫...')
    const result = sipSessionCall.call(targetUri)
    console.log('📤 呼叫请求返回值:', result)

    if (result !== 0) {
      throw new Error(`呼叫失败，返回码: ${result}`)
    }
  } catch (err) {
    console.error('❌ 拨打电话失败:', err)
    throw err
  }
}

const hangup = () => {
  if (sipSessionCall) sipSessionCall.hangup()
}

const acceptIncomingCall = async () => {
  if (!sipSessionCall) return
  try {
    console.log('📞 接听来电...')
    sipSessionCall.accept({
      audio_remote: audioRemote.value,
      video_local: null,
      video_remote: null,
      // 优化接听配置
      bandwidth: { audio: 64, video: 0 },
      media_constraints: {
        audio: true,
        video: false,
      },
    })
    console.log('✅ 接听来电成功')
  } catch (error) {
    console.error('❌ 接听来电失败:', error)
    throw error
  }
}

const rejectIncomingCall = async () => {
  if (!sipSessionCall) return
  sipSessionCall.hangup()
}

const hold = () => sipSessionCall && sipSessionCall.hold()
const unhold = () => sipSessionCall && sipSessionCall.resume()
const mute = () => sipSessionCall && sipSessionCall.mute('audio')
const unmute = () => sipSessionCall && sipSessionCall.unmute('audio')
const sendDtmf = (tone: string) => sipSessionCall && sipSessionCall.dtmf(tone)
const handleSendDtmf = (tone: string) => sendDtmf(tone)

const onSipEventMessage = (e: any) => {
  if (e.type === 'sent') {
    ElMessage.success('消息发送成功')
  } else if (e.type === 'failed' || e.type === 'error') {
    ElMessage.error('消息发送失败')
  }
}

const handleSendMessage = async () => {
  try {
    if (!sipStack) throw new Error('SIP 栈未启动')
    const messagingSession = sipStack.newSession('message', {
      events_listener: { events: '*', listener: onSipEventMessage },
    })
    // 目标：若输入的是号码而非 URI，则补全为 sip:xxx@realm
    const dest = normalizeTargetToSipUri(target.value)
    messagingSession.send(dest, messageText.value, 'text/plain')
  } catch (error) {
    console.error('发送消息失败:', error)
    ElMessage.error(`发送消息失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

const handleRegister = () => register().catch((e) => ElMessage.error((e as Error).message))
const handleUnregister = () => unregister().catch(() => {})

const handleStartCall = async () => {
  if (isLoading.value) return
  isLoading.value = true
  callStatus.value = '准备拨号...'
  try {
    ElMessage.info('正在拨打电话...')
    await ensureRegisteredThen(() => makeCall(target.value))
    ElMessage.success('拨号成功，等待接听...')
    callStatus.value = '等待响应...'
  } catch (error) {
    console.error('拨打电话失败:', error)
    ElMessage.error(`拨打电话失败: ${error instanceof Error ? error.message : '未知错误'}`)
    callStatus.value = ''
    isCalling.value = false
  } finally {
    isLoading.value = false
  }
}

const handleEndCall = () => hangup()
const handleHold = () => hold()
const handleUnhold = () => unhold()
const handleMute = () => mute()
const handleUnmute = () => unmute()

const handleAcceptCall = async () => {
  try {
    await acceptIncomingCall()
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

const handleDiagnose = () => {
  const SIPml = getSIPml()
  if (!SIPml) {
    ElMessage.error('SIPml5 脚本未加载')
    return
  }
  const support = SIPml.isWebRtcSupported() && SIPml.isWebSocketSupported()
  ElMessage.info(
    support ? '环境检测通过：支持 WebRTC 与 WebSocket' : '环境检测失败：请检查浏览器或网络',
  )
}

const formatTime = (date: Date) =>
  date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

onMounted(() => {
  // 修复现代浏览器中 SIPml5 的兼容性问题
  // 1. createObjectURL for MediaStream 已废弃
  if (typeof window !== 'undefined' && window.URL) {
    const originalCreateObjectURL = window.URL.createObjectURL.bind(window.URL)
    const originalRevokeObjectURL = window.URL.revokeObjectURL.bind(window.URL)

    window.URL.createObjectURL = function (obj: any) {
      if (obj && typeof obj.getTracks === 'function') {
        // 这是一个 MediaStream，返回一个虚拟 URL
        // 现代浏览器会直接使用 srcObject
        return 'blob:mediastream-' + Math.random().toString(36).substr(2, 9)
      }
      return originalCreateObjectURL(obj)
    }

    window.URL.revokeObjectURL = function (url: string) {
      if (url && url.startsWith('blob:mediastream-')) {
        // 对于我们的虚拟 MediaStream URL，不做任何操作
        return
      }
      return originalRevokeObjectURL(url)
    }
  }
})

onBeforeUnmount(() => {
  try {
    if (sipSessionCall) sipSessionCall.hangup()
    if (sipSessionRegister) sipSessionRegister.unregister()
    if (sipStack) sipStack.stop()
  } catch {}
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
</style>
