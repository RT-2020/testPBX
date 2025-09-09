import { ref, shallowRef, type Ref } from 'vue'
import {
  UserAgent,
  Registerer,
  Inviter,
  Invitation,
  SessionState,
  Messager,
  type UserAgentOptions,
  type InviterOptions,
} from 'sip.js'

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

export const useSipClient = () => {
  const ua = shallowRef<UserAgent | null>(null)
  const registerer = shallowRef<Registerer | null>(null)
  const inviter = shallowRef<Inviter | null>(null)
  const incomingInvitation = shallowRef<Invitation | null>(null)

  const isRegistered = ref(false)
  const isCalling = ref(false)
  const isCallEstablished = ref(false)
  const isHeld = ref(false)
  const isMuted = ref(false)
  const hasIncomingCall = ref(false)
  const incomingCallerInfo = ref<{ name: string; uri: string } | null>(null)
  const receivedMessages = ref<ReceivedMessage[]>([])
  const videoRefs = shallowRef<VideoRefs | null>(null)

  const attachVideoElements = (refs: VideoRefs) => (videoRefs.value = refs)

  const createUA = (params: RegisterParams): UserAgent => {
    const uri = UserAgent.makeURI(params.uri)
    if (!uri) throw new Error('Invalid SIP URI')

    const transportOptions = { server: params.wsServers }
    const authorizationUsername = params.authUser
    const authorizationPassword = params.password

    const options: UserAgentOptions = {
      uri,
      transportOptions,
      authorizationUsername,
      authorizationPassword,
      displayName: params.displayName,
      sessionDescriptionHandlerFactoryOptions: {
        peerConnectionConfiguration: { iceServers: [] },
      },
    }
    return new UserAgent(options)
  }

  const register = async (params: RegisterParams) => {
    if (ua.value) await unregister()
    ua.value = createUA(params)

    // 添加UA事件监听
    ua.value.transport.onConnect = () => {
      console.log('WebSocket连接已建立')
    }

    ua.value.transport.onDisconnect = (error?: Error) => {
      console.log('WebSocket连接断开:', error?.message || '正常断开')
    }

    ua.value.transport.onMessage = (message) => {
      console.log('收到SIP消息:', message)
    }

    // 添加更多网络事件监听
    const transport = ua.value.transport as any
    if (transport.onError) {
      transport.onError = (error: any) => {
        console.error('WebSocket错误:', error)
      }
    }

    // 监听UA级别的事件
    ua.value.delegate = {
      onInvite: (invitation) => {
        console.log('收到来电邀请')
        incomingInvitation.value = invitation
        hasIncomingCall.value = true

        // 获取来电者信息
        const fromHeader = invitation.request.from
        const callerUri = fromHeader?.uri?.toString() || 'Unknown'
        const callerName = fromHeader?.displayName || callerUri

        incomingCallerInfo.value = {
          name: callerName,
          uri: callerUri,
        }

        console.log('来电者:', callerName, callerUri)

        // 监听邀请状态变化
        invitation.stateChange.addListener((state) => {
          console.log('来电状态变化:', state)
          if (state === SessionState.Terminated) {
            hasIncomingCall.value = false
            incomingCallerInfo.value = null
            incomingInvitation.value = null
          }
          if (state === SessionState.Established) {
            isCallEstablished.value = true
            isCalling.value = true
            bindMedia(invitation)
          }
        })
      },
      onMessage: (message) => {
        console.log('收到消息:', message)

        // 解析消息内容
        const fromHeader = message.request.from
        const fromUri = fromHeader?.uri?.toString() || 'Unknown'
        const fromName = fromHeader?.displayName || fromUri
        const content = message.request.body || ''

        const receivedMessage: ReceivedMessage = {
          id: Date.now().toString(),
          from: `${fromName} <${fromUri}>`,
          content,
          timestamp: new Date(),
        }

        receivedMessages.value.unshift(receivedMessage)
        console.log('新消息:', receivedMessage)
      },
      onNotify: (notification) => {
        console.log('收到通知:', notification)
      },
    }

    registerer.value = new Registerer(ua.value)

    console.log('正在启动UA并连接到:', params.wsServers)
    await ua.value.start()
    console.log('UA已启动，开始注册...')
    await registerer.value.register()
    console.log('注册成功')
    isRegistered.value = true
  }

  const unregister = async () => {
    try {
      await registerer.value?.unregister()
    } catch {}
    try {
      await ua.value?.stop()
    } catch {}
    isRegistered.value = false
  }

  type CallOptions = { audio?: boolean; video?: boolean; inviteWithoutSdp?: boolean }

  const makeCall = async (target: string, options: CallOptions = {}) => {
    if (!ua.value) throw new Error('UA not ready')
    const targetURI = UserAgent.makeURI(target)
    if (!targetURI) throw new Error('Invalid target URI')

    try {
      const media: InviterOptions = {
        sessionDescriptionHandlerOptions: {
          constraints: {
            audio: options.audio ?? true,
            video: options.video ?? false,
          },
        },
        inviteWithoutSdp: !!options.inviteWithoutSdp,
      }

      inviter.value = new Inviter(ua.value, targetURI, media)

      inviter.value.stateChange.addListener((state) => {
        console.log('通话状态变化:', state)
        if (state === SessionState.Establishing) {
          console.log('正在建立通话...')
        }
        if (state === SessionState.Established) {
          console.log('通话已建立')
          isCallEstablished.value = true
          bindMedia(inviter.value!)
        }
        if (state === SessionState.Terminating) {
          console.log('正在结束通话...')
        }
        if (state === SessionState.Terminated) {
          console.log('通话已结束')
          // 获取终止原因
          const session = inviter.value
          if (session) {
            const cause = (session as any).cause
            const reasonPhrase = (session as any).reasonPhrase
            console.log('通话结束原因:', { cause, reasonPhrase })

            // 检查是否有详细的错误信息
            const sessionAny = session as any
            if (sessionAny.incomingResponse) {
              const response = sessionAny.incomingResponse
              console.log('SIP响应:', response.statusCode, response.reasonPhrase)
              if (response.statusCode >= 400) {
                console.error('SIP错误响应:', response.statusCode, response.reasonPhrase)
              }
            }
          }
          isCalling.value = false
          isCallEstablished.value = false
          isHeld.value = false
          isMuted.value = false
        }
      })

      console.log('开始拨打电话到:', target)
      isCalling.value = true

      // 添加邀请失败的监听
      const inviterAny = inviter.value as any
      inviterAny.delegate = {
        onReject: (response: any) => {
          console.log('通话被拒绝:', response.statusCode, response.reasonPhrase)
        },
        onCancel: () => {
          console.log('通话被取消')
        },
        onProgress: (response: any) => {
          console.log('通话进展:', response.statusCode, response.reasonPhrase)
        },
        onAccept: () => {
          console.log('通话被接受')
        },
      }

      // 设置一个超时检查
      const inviteTimeout = setTimeout(() => {
        if (isCalling.value && !isCallEstablished.value) {
          console.warn('拨号超时 - 可能的原因：')
          console.warn('1. 目标号码不存在或不在线')
          console.warn('2. 网络连接问题')
          console.warn('3. SIP服务器配置问题')
          console.warn('4. WebRTC媒体获取失败')

          // 检查WebSocket连接状态
          const transport = ua.value?.transport
          if (transport) {
            console.log('WebSocket连接状态:', transport.isConnected())
          }
        }
      }, 5000) // 5秒后检查

      // 清理超时检查
      inviter.value.stateChange.addListener((state) => {
        if (state === SessionState.Established || state === SessionState.Terminated) {
          clearTimeout(inviteTimeout)
        }
      })

      await inviter.value.invite()
      console.log('拨号请求已发送')
    } catch (error) {
      console.error('拨打电话时发生错误:', error)
      isCalling.value = false
      isHeld.value = false
      isMuted.value = false
      throw error
    }
  }

  const bindMedia = (session: Inviter | Invitation) => {
    const sdh = (session as any).sessionDescriptionHandler
    const pc: RTCPeerConnection | undefined = sdh?.peerConnection
    if (!pc) return

    pc.ontrack = (event: RTCTrackEvent) => {
      if (event.track.kind === 'video' && videoRefs.value?.remote.value) {
        const [stream] = event.streams.length ? event.streams : [new MediaStream([event.track])]
        videoRefs.value.remote.value.srcObject = stream
      }
      if (event.track.kind === 'audio') {
        const [stream] = event.streams.length ? event.streams : [new MediaStream([event.track])]
        const audio = new Audio()
        audio.srcObject = stream
        audio.play().catch(() => {})
      }
    }

    // Attach local video if available
    pc.getSenders().forEach((sender) => {
      const track = sender.track
      if (track?.kind === 'video' && videoRefs.value?.local.value) {
        const stream = new MediaStream([track])
        videoRefs.value.local.value.srcObject = stream
      }
    })
  }

  const hangup = async () => {
    try {
      if (inviter.value) {
        await inviter.value.bye()
      } else if (incomingInvitation.value) {
        await incomingInvitation.value.bye()
      }
    } catch {}
    isCalling.value = false
    isCallEstablished.value = false
    isHeld.value = false
    isMuted.value = false
    hasIncomingCall.value = false
    incomingCallerInfo.value = null
    incomingInvitation.value = null
  }

  const acceptIncomingCall = async (options: CallOptions = {}) => {
    if (!incomingInvitation.value) throw new Error('No incoming call to accept')

    try {
      const sessionDescriptionHandlerOptions = {
        constraints: {
          audio: options.audio ?? true,
          video: options.video ?? false,
        },
      }

      await incomingInvitation.value.accept({ sessionDescriptionHandlerOptions })
      console.log('已接听来电')
      hasIncomingCall.value = false
      isCalling.value = true
    } catch (error) {
      console.error('接听来电失败:', error)
      hasIncomingCall.value = false
      incomingCallerInfo.value = null
      incomingInvitation.value = null
      throw error
    }
  }

  const rejectIncomingCall = async () => {
    if (!incomingInvitation.value) throw new Error('No incoming call to reject')

    try {
      await incomingInvitation.value.reject()
      console.log('已拒绝来电')
    } catch (error) {
      console.error('拒绝来电失败:', error)
    } finally {
      hasIncomingCall.value = false
      incomingCallerInfo.value = null
      incomingInvitation.value = null
    }
  }

  const sendDtmf = async (tone: string) => {
    if (!inviter.value) throw new Error('No active session')
    if (!/^[0-9A-D#*,]$/.test(tone)) throw new Error('Invalid DTMF tone')
    const body = {
      contentDisposition: 'render',
      contentType: 'application/dtmf-relay',
      content: `Signal=${tone}\r\nDuration=200`,
    }
    // @ts-ignore - sip.js loosely types requestOptions
    await inviter.value.info({ requestOptions: { body } })
  }

  const setHold = async (hold: boolean) => {
    if (!inviter.value) throw new Error('No active session')
    // mark desired hold state for re-INVITE
    const opts = inviter.value.sessionDescriptionHandlerOptionsReInvite || {}
    // @ts-expect-error - hold property exists in sessionDescriptionHandlerOptions
    inviter.value.sessionDescriptionHandlerOptionsReInvite = { ...opts, hold }
    await inviter.value.invite({})
    isHeld.value = hold
  }

  const hold = async () => setHold(true)
  const unhold = async () => setHold(false)

  const setMute = (mute: boolean) => {
    // disable/enable sender tracks
    // Use SDP handler if available, otherwise peer connection senders
    const session: any = inviter.value as any
    const pc: RTCPeerConnection | undefined = session?.sessionDescriptionHandler?.peerConnection
    if (pc) pc.getSenders().forEach((s) => s.track && (s.track.enabled = !mute))
    isMuted.value = mute
  }

  const mute = () => setMute(true)
  const unmute = () => setMute(false)

  const transfer = async (target: string) => {
    if (!inviter.value) throw new Error('No active session')
    const uri = UserAgent.makeURI(target)
    if (!uri) throw new Error('Invalid transfer target')
    await inviter.value.refer(uri)
  }

  const sendMessage = async (destination: string, message: string) => {
    if (!ua.value) throw new Error('UA not ready')
    const target = UserAgent.makeURI(destination)
    if (!target) throw new Error('Invalid message destination')

    try {
      const messager = new Messager(ua.value, target, message)
      await messager.message()
      console.log('消息发送成功到:', destination)
      return { success: true, message: '消息发送成功' }
    } catch (error) {
      console.error('发送消息失败:', error)
      throw error
    }
  }

  const diagnoseConnection = () => {
    console.log('=== SIP连接诊断 ===')
    console.log('注册状态:', isRegistered.value ? '已注册' : '未注册')
    console.log('通话状态:', isCalling.value ? '通话中' : '空闲')

    if (ua.value) {
      const transport = ua.value.transport
      console.log('WebSocket连接:', transport.isConnected() ? '已连接' : '未连接')
      console.log('UA状态:', ua.value.state)

      if (registerer.value) {
        console.log('注册器状态:', registerer.value.state)
      }
    } else {
      console.log('UA未初始化')
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
