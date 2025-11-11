import { ref, shallowRef, type Ref } from 'vue'
import JsSIP from 'jssip'

type VideoRefs = { local: Ref<HTMLVideoElement | null>; remote: Ref<HTMLVideoElement | null> }

type RegisterParams = {
  uri: string
  wsServers: string
  authUser: string
  password: string
  displayName?: string
}

type ReceivedMessage = {
  id: string
  from: string
  content: string
  timestamp: Date
}

type CallOptions = { audio?: boolean; video?: boolean; inviteWithoutSdp?: boolean }

export const useJsSipClient = () => {
  const ua = shallowRef<JsSIP.UA | null>(null)
  const currentSession = shallowRef<JsSIP.RTCSession | null>(null)
  const incomingSession = shallowRef<JsSIP.RTCSession | null>(null)

  const isRegistered = ref(false)
  const isCalling = ref(false)
  const isCallEstablished = ref(false)
  const isHeld = ref(false)
  const isMuted = ref(false)
  const hasIncomingCall = ref(false)
  const incomingCallerInfo = ref<{ name: string; uri: string } | null>(null)
  const receivedMessages = ref<ReceivedMessage[]>([])
  const videoRefs = shallowRef<VideoRefs | null>(null)
  const iceServers = [
    // { urls: ['stun:stun.l.google.com:19302'] },
    // { urls: ['stun:stun1.l.google.com:19302'] },
    // { urls: ['stun:stun.qq.com'] },
    // { urls: ['stun:miwifi.com'] },
  ]

  const attachVideoElements = (refs: VideoRefs) => (videoRefs.value = refs)

  const parseHostFromUri = (uri: string): string => {
    const match = uri.match(/@([^;:>]+)/)
    return match ? match[1] : 'localhost'
  }

  const register = async (params: RegisterParams): Promise<void> => {
    if (ua.value) {
      await unregister()
    }

    return new Promise((resolve, reject) => {
      const host = parseHostFromUri(params.uri)

      const configuration: JsSIP.UAConfiguration = {
        sockets: [new JsSIP.WebSocketInterface(params.wsServers)],
        uri: params.uri,
        authorization_user: params.authUser,
        password: params.password,
        display_name: params.displayName || 'JsSIP Client',
        session_timers: false,
        register: true,
        pcConfig: {
          iceServers: iceServers,
        },
      }

      console.log('创建 JsSIP UA，配置:', configuration)

      try {
        ua.value = new JsSIP.UA(configuration)
      } catch (error) {
        console.error('创建 UA 失败:', error)
        reject(error)
        return
      }

      // WebSocket 连接事件
      ua.value.on('connected', (e: any) => {
        console.log('✅ WebSocket 已连接', e)
      })

      ua.value.on('disconnected', (e: any) => {
        console.log('❌ WebSocket 已断开', e)
        isRegistered.value = false
      })

      // 注册事件
      ua.value.on('registered', (e: any) => {
        console.log('✅ SIP 注册成功', e)
        isRegistered.value = true
        resolve()
      })

      ua.value.on('unregistered', (e: any) => {
        console.log('📤 SIP 已注销', e)
        isRegistered.value = false
      })

      ua.value.on('registrationFailed', (e: any) => {
        console.error('❌ SIP 注册失败', e)
        isRegistered.value = false
        reject(new Error(`注册失败: ${e.cause || e.response?.status_code || '未知错误'}`))
      })

      // 来电处理
      ua.value.on('newRTCSession', (e: any) => {
        const session: JsSIP.RTCSession = e.session

        console.log('📞 收到 RTC 会话', e)

        // 处理来电
        if (session.direction === 'incoming') {
          console.log('📞 来电')
          incomingSession.value = session
          hasIncomingCall.value = true

          const remoteIdentity = session.remote_identity
          const callerUri = remoteIdentity?.uri?.toString() || 'Unknown'
          const callerName = remoteIdentity?.display_name || callerUri

          incomingCallerInfo.value = {
            name: callerName,
            uri: callerUri,
          }

          console.log('来电者:', callerName, callerUri)

          // 监听来电的状态变化
          setupSessionListeners(session)
        } else {
          // 呼出电话
          console.log('📞 呼出会话')
        }
      })

      // 接收消息
      ua.value.on('newMessage', (e: any) => {
        console.log('📨 收到新消息', e)

        const originator = e.originator
        if (originator === 'remote') {
          const request = e.request
          const fromHeader = request.from
          const fromUri = fromHeader?.uri?.toString() || 'Unknown'
          const fromName = fromHeader?.display_name || fromUri
          const content = request.body || ''

          const receivedMessage: ReceivedMessage = {
            id: Date.now().toString(),
            from: `${fromName} <${fromUri}>`,
            content,
            timestamp: new Date(),
          }

          receivedMessages.value.unshift(receivedMessage)
          console.log('新消息:', receivedMessage)
        }
      })

      // 启动 UA
      console.log('启动 JsSIP UA...')
      ua.value.start()

      // 设置超时
      const timeout = setTimeout(() => {
        console.warn('⏰ 注册超时')
        reject(new Error('注册超时'))
      }, 30000)

      // 清理超时
      ua.value.once('registered', () => clearTimeout(timeout))
      ua.value.once('registrationFailed', () => clearTimeout(timeout))
    })
  }

  const setupSessionListeners = (session: JsSIP.RTCSession) => {
    // 通话进展
    session.on('progress', (e: any) => {
      console.log('📞 通话进展', e)
    })

    // 通话接受
    session.on('accepted', (e: any) => {
      console.log('✅ 通话已接受', e)
    })

    // 通话确认（建立）
    session.on('confirmed', (e: any) => {
      console.log('✅ 通话已建立', e)
      isCallEstablished.value = true
      isCalling.value = true

      // 绑定媒体流
      bindMedia(session)
    })

    // 通话结束
    session.on('ended', (e: any) => {
      console.log('📞 通话已结束', e)
      endCall()
    })

    // 通话失败
    session.on('failed', (e: any) => {
      // 增强失败日志，便于定位如 "Bad Media Description" 等错误
      const cause = e?.cause || e?.message || '未知原因'
      const status = e?.response?.status_code
      const reason = e?.response?.reason_phrase
      const body = e?.response?.body
      console.error('❌ 通话失败', {
        originator: e?.originator,
        cause,
        status,
        reason,
        sdp: body,
      })
      endCall()
    })

    // Hold 状态
    session.on('hold', (e: any) => {
      console.log('📞 通话保持', e)
      if (e.originator === 'local') {
        isHeld.value = true
      }
    })

    session.on('unhold', (e: any) => {
      console.log('📞 通话恢复', e)
      if (e.originator === 'local') {
        isHeld.value = false
      }
    })

    // Mute 状态
    session.on('muted', (e: any) => {
      console.log('🔇 已静音', e)
    })

    session.on('unmuted', (e: any) => {
      console.log('🔊 已取消静音', e)
    })
  }

  const bindMedia = (session: JsSIP.RTCSession) => {
    const connection = session.connection as RTCPeerConnection

    if (!connection) {
      console.warn('⚠️ 没有 RTCPeerConnection')
      return
    }

    // 处理远程音视频流
    connection.ontrack = (event: RTCTrackEvent) => {
      console.log('📡 收到媒体轨道', event.track.kind, event)

      if (event.track.kind === 'video' && videoRefs.value?.remote.value) {
        const [stream] = event.streams.length ? event.streams : [new MediaStream([event.track])]
        videoRefs.value.remote.value.srcObject = stream
        console.log('📹 远程视频流已绑定')
      }

      if (event.track.kind === 'audio') {
        const [stream] = event.streams.length ? event.streams : [new MediaStream([event.track])]
        const audio = new Audio()
        audio.srcObject = stream
        audio.play().catch((err) => console.error('播放音频失败:', err))
        console.log('🔊 远程音频流已播放')
      }
    }

    // 获取本地视频流（如果有）
    const localStream = session.connection.getLocalStreams()[0]
    if (localStream && videoRefs.value?.local.value) {
      videoRefs.value.local.value.srcObject = localStream
      console.log('📹 本地视频流已绑定')
    }

    // 额外记录 PeerConnection 状态，定位 ICE/SDP 相关问题
    try {
      const pc = session.connection as RTCPeerConnection
      if (pc) {
        console.log('🔧 绑定 PeerConnection 状态监听')
        pc.oniceconnectionstatechange = () =>
          console.log('🧊 ICE 连接状态:', pc.iceConnectionState)
        pc.onsignalingstatechange = () =>
          console.log('📶 信令状态:', pc.signalingState)
        pc.onconnectionstatechange = () =>
          console.log('🤝 总体连接状态:', pc.connectionState)
      }
    } catch (err) {
      console.warn('绑定 PeerConnection 状态失败:', err)
    }
  }

  const unregister = async (): Promise<void> => {
    console.log('开始注销 JsSIP...')

    try {
      if (currentSession.value) {
        currentSession.value.terminate()
        currentSession.value = null
      }

      if (incomingSession.value) {
        incomingSession.value.terminate()
        incomingSession.value = null
      }

      if (ua.value) {
        if (ua.value.isRegistered()) {
          ua.value.unregister()
        }
        ua.value.stop()
        ua.value = null
      }

      isRegistered.value = false
      isCalling.value = false
      isCallEstablished.value = false
      isHeld.value = false
      isMuted.value = false
      hasIncomingCall.value = false
      incomingCallerInfo.value = null

      console.log('✅ JsSIP 注销完成')
    } catch (error) {
      console.error('注销时发生错误:', error)
    }
  }

  const makeCall = async (target: string, options: CallOptions = {}): Promise<void> => {
    if (!ua.value) {
      throw new Error('UA 未就绪')
    }

    if (!ua.value.isRegistered()) {
      throw new Error('未注册，无法拨打电话')
    }

    console.log('📞 开始拨打电话到:', target, '选项:', options)

    const callOptions: JsSIP.CallOptions = {
      mediaConstraints: {
        audio: options.audio ?? true,
        video: options.video ?? false,
      },
      rtcOfferConstraints: {
        offerToReceiveAudio: options.audio ?? true,
        offerToReceiveVideo: options.video ?? false,
      },
      pcConfig: {
        iceServers: iceServers,
      },
    }

    // 无媒体模式
    if (options.inviteWithoutSdp) {
      callOptions.mediaConstraints = { audio: false, video: false }
      callOptions.rtcOfferConstraints = {
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      }
    }

    try {
      const session = ua.value.call(target, callOptions) as JsSIP.RTCSession
      currentSession.value = session
      isCalling.value = true

      console.log('📤 呼叫已发起', session)

      // 设置监听器
      setupSessionListeners(session)
    } catch (error) {
      console.error('❌ 拨打电话失败:', error)
      isCalling.value = false
      throw error
    }
  }

  const hangup = async (): Promise<void> => {
    console.log('挂断电话')

    try {
      if (currentSession.value) {
        currentSession.value.terminate()
        currentSession.value = null
      }

      if (incomingSession.value) {
        incomingSession.value.terminate()
        incomingSession.value = null
      }

      endCall()
    } catch (error) {
      console.error('挂断时发生错误:', error)
    }
  }

  const endCall = () => {
    isCalling.value = false
    isCallEstablished.value = false
    isHeld.value = false
    isMuted.value = false
    hasIncomingCall.value = false
    incomingCallerInfo.value = null
    currentSession.value = null
    incomingSession.value = null
  }

  const acceptIncomingCall = async (options: CallOptions = {}): Promise<void> => {
    if (!incomingSession.value) {
      throw new Error('没有来电可接听')
    }

    console.log('接听来电', options)

    const callOptions: JsSIP.AnswerOptions = {
      mediaConstraints: {
        audio: options.audio ?? true,
        video: options.video ?? false,
      },
      pcConfig: {
        iceServers: iceServers,
      },
    }

    try {
      incomingSession.value.answer(callOptions)
      currentSession.value = incomingSession.value
      hasIncomingCall.value = false
      isCalling.value = true
      console.log('✅ 已接听来电')
    } catch (error) {
      console.error('接听来电失败:', error)
      hasIncomingCall.value = false
      incomingCallerInfo.value = null
      incomingSession.value = null
      throw error
    }
  }

  const rejectIncomingCall = async (): Promise<void> => {
    if (!incomingSession.value) {
      throw new Error('没有来电可拒绝')
    }

    console.log('拒绝来电')

    try {
      incomingSession.value.terminate()
      console.log('✅ 已拒绝来电')
    } catch (error) {
      console.error('拒绝来电失败:', error)
    } finally {
      hasIncomingCall.value = false
      incomingCallerInfo.value = null
      incomingSession.value = null
    }
  }

  const sendDtmf = async (tone: string): Promise<void> => {
    if (!currentSession.value) {
      throw new Error('没有活动会话')
    }

    if (!/^[0-9A-D#*]$/.test(tone)) {
      throw new Error('无效的 DTMF 音调')
    }

    console.log('发送 DTMF:', tone)

    try {
      currentSession.value.sendDTMF(tone)
    } catch (error) {
      console.error('发送 DTMF 失败:', error)
      throw error
    }
  }

  const hold = async (): Promise<void> => {
    if (!currentSession.value) {
      throw new Error('没有活动会话')
    }

    console.log('保持通话')

    try {
      currentSession.value.hold()
      isHeld.value = true
    } catch (error) {
      console.error('保持通话失败:', error)
      throw error
    }
  }

  const unhold = async (): Promise<void> => {
    if (!currentSession.value) {
      throw new Error('没有活动会话')
    }

    console.log('恢复通话')

    try {
      currentSession.value.unhold()
      isHeld.value = false
    } catch (error) {
      console.error('恢复通话失败:', error)
      throw error
    }
  }

  const mute = (): void => {
    if (!currentSession.value) {
      throw new Error('没有活动会话')
    }

    console.log('静音')

    try {
      currentSession.value.mute({ audio: true, video: false })
      isMuted.value = true
    } catch (error) {
      console.error('静音失败:', error)
      throw error
    }
  }

  const unmute = (): void => {
    if (!currentSession.value) {
      throw new Error('没有活动会话')
    }

    console.log('取消静音')

    try {
      currentSession.value.unmute({ audio: true, video: false })
      isMuted.value = false
    } catch (error) {
      console.error('取消静音失败:', error)
      throw error
    }
  }

  const transfer = async (target: string): Promise<void> => {
    if (!currentSession.value) {
      throw new Error('没有活动会话')
    }

    console.log('转接到:', target)

    try {
      currentSession.value.refer(target)
      console.log('✅ 转接请求已发送')
    } catch (error) {
      console.error('转接失败:', error)
      throw error
    }
  }

  const sendMessage = async (destination: string, message: string): Promise<void> => {
    if (!ua.value) {
      throw new Error('UA 未就绪')
    }

    if (!ua.value.isRegistered()) {
      throw new Error('未注册，无法发送消息')
    }

    console.log('发送消息到:', destination, '内容:', message)

    return new Promise((resolve, reject) => {
      const options = {
        contentType: 'text/plain',
        eventHandlers: {
          succeeded: (e: any) => {
            console.log('✅ 消息发送成功', e)
            resolve()
          },
          failed: (e: any) => {
            console.error('❌ 消息发送失败', e)
            reject(new Error(`消息发送失败: ${e.cause || '未知错误'}`))
          },
        },
      }

      try {
        ua.value!.sendMessage(destination, message, options)
      } catch (error) {
        console.error('发送消息时发生错误:', error)
        reject(error)
      }
    })
  }

  const diagnoseConnection = (): void => {
    console.log('=== JsSIP 连接诊断 ===')
    console.log('📋 基本状态:')
    console.log('  - 注册状态:', isRegistered.value ? '✅ 已注册' : '❌ 未注册')
    console.log('  - 通话状态:', isCalling.value ? '📞 通话中' : '⭕ 空闲')
    console.log('  - 通话已建立:', isCallEstablished.value ? '✅ 是' : '❌ 否')
    console.log('  - 来电状态:', hasIncomingCall.value ? '📞 有来电' : '⭕ 无来电')

    if (ua.value) {
      console.log('🌐 UA 信息:')
      console.log('  - UA 状态:', ua.value.isRegistered() ? '已注册' : '未注册')
      console.log('  - UA 已连接:', ua.value.isConnected() ? '是' : '否')
      console.log('  - 配置:', ua.value.configuration)
    } else {
      console.log('🚫 UA: 未初始化')
    }

    console.log('💡 故障排除建议:')
    if (!ua.value) {
      console.log('  - 请先进行 SIP 注册')
    } else if (!ua.value.isConnected()) {
      console.log('  - 检查 WebSocket 服务器地址是否正确')
      console.log('  - 检查网络连接是否正常')
      console.log('  - 检查防火墙设置')
    } else if (!isRegistered.value) {
      console.log('  - 检查 SIP URI 格式是否正确')
      console.log('  - 检查用户名和密码是否正确')
      console.log('  - 检查 SIP 服务器是否允许该用户注册')
    }
    console.log('================')
  }

  return {
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
    attachVideoElements,
    diagnoseConnection,
  }
}
