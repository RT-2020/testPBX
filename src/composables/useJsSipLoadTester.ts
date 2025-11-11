import { ref } from 'vue'
import JsSIP from 'jssip'

type SipAuth = {
  uri: string
  wsServers: string
  authUser: string
  password: string
  displayName?: string
}

type LoadOptions = {
  auth: SipAuth
  target: string
  concurrent: number
  callSeconds: number
  autoHangup: boolean
}

type CallHandle = {
  ua: JsSIP.UA
  session: JsSIP.RTCSession
}

export const useJsSipLoadTester = () => {
  const isRunning = ref(false)
  const startedAt = ref<number | null>(null)
  const numActiveCalls = ref(0)
  const numSucceeded = ref(0)
  const numFailed = ref(0)
  const totalAttempts = ref(0)
  const progress = ref(0)

  let handles: CallHandle[] = []

  const parseHostFromUri = (uri: string): string => {
    const match = uri.match(/@([^;:>]+)/)
    return match ? match[1] : 'localhost'
  }

  const createUA = (auth: SipAuth): JsSIP.UA => {
    const configuration: JsSIP.UAConfiguration = {
      sockets: [new JsSIP.WebSocketInterface(auth.wsServers)],
      uri: auth.uri,
      authorization_user: auth.authUser,
      password: auth.password,
      display_name: auth.displayName || 'LoadTester',
      session_timers: false,
      register: false, // 压测不注册，直接拨号
      pcConfig: {
        iceServers: [
          { urls: ['stun:stun.l.google.com:19302'] },
          { urls: ['stun:stun1.l.google.com:19302'] },
        ],
      },
    }

    return new JsSIP.UA(configuration)
  }

  const placeOneCall = async (
    auth: SipAuth,
    target: string,
    callSeconds: number,
    autoHangup: boolean,
  ): Promise<void> => {
    totalAttempts.value++
    let ua: JsSIP.UA | null = null
    let session: JsSIP.RTCSession | null = null

    return new Promise<void>((resolve) => {
      try {
        ua = createUA(auth)

        // UA 启动
        ua.start()

        // 等待连接
        ua.once('connected', () => {
          if (!ua) {
            numFailed.value++
            resolve()
            return
          }

          // 无媒体模式拨号，避免麦克风权限请求
          const callOptions: JsSIP.CallOptions = {
            mediaConstraints: {
              audio: false,
              video: false,
            },
            rtcOfferConstraints: {
              offerToReceiveAudio: false,
              offerToReceiveVideo: false,
            },
          }

          try {
            session = ua.call(target, callOptions) as JsSIP.RTCSession

            if (session) {
              handles.push({ ua, session })
              numActiveCalls.value++
              let wasEstablished = false

              // 监听通话建立
              session.on('confirmed', () => {
                console.log('✅ 压测通话已建立')
                numSucceeded.value++
                wasEstablished = true

                // 自动挂断
                if (autoHangup) {
                  setTimeout(() => {
                    if (session) {
                      try {
                        session.terminate()
                      } catch (e) {
                        console.error('自动挂断失败:', e)
                      }
                    }
                  }, callSeconds * 1000)
                }
              })

              // 监听通话结束
              session.on('ended', () => {
                console.log('📞 压测通话已结束')
                numActiveCalls.value--
                if (!wasEstablished) {
                  numFailed.value++
                }

                // 清理 UA
                try {
                  if (ua) {
                    ua.stop()
                  }
                } catch (e) {
                  console.error('停止 UA 失败:', e)
                }

                resolve()
              })

              // 监听通话失败
              session.on('failed', (e: any) => {
                console.error('❌ 压测通话失败:', e.cause)
                numActiveCalls.value--
                if (!wasEstablished) {
                  numFailed.value++
                }

                // 清理 UA
                try {
                  if (ua) {
                    ua.stop()
                  }
                } catch (e) {
                  console.error('停止 UA 失败:', e)
                }

                resolve()
              })
            } else {
              numFailed.value++
              numActiveCalls.value--
              if (ua) {
                ua.stop()
              }
              resolve()
            }
          } catch (error) {
            console.error('拨号失败:', error)
            numFailed.value++
            if (ua) {
              ua.stop()
            }
            resolve()
          }
        })

        // 连接失败
        ua.once('disconnected', () => {
          console.error('❌ WebSocket 连接失败')
          numFailed.value++
          resolve()
        })
      } catch (error) {
        console.error('创建 UA 失败:', error)
        numFailed.value++
        if (ua) {
          try {
            ua.stop()
          } catch (e) {
            console.error('停止 UA 失败:', e)
          }
        }
        resolve()
      }
    })
  }

  const startLoad = async (opts: LoadOptions): Promise<void> => {
    if (isRunning.value) return

    isRunning.value = true
    startedAt.value = Date.now()
    numActiveCalls.value = 0
    numSucceeded.value = 0
    numFailed.value = 0
    totalAttempts.value = 0
    progress.value = 0
    handles = []

    console.log('🚀 开始压测，并发数:', opts.concurrent)

    const jobs: Promise<void>[] = []
    for (let i = 0; i < opts.concurrent; i++) {
      jobs.push(placeOneCall(opts.auth, opts.target, opts.callSeconds, opts.autoHangup))
    }

    await Promise.all(jobs)

    isRunning.value = false
    progress.value = 100

    console.log('✅ 压测完成')
    console.log('成功:', numSucceeded.value)
    console.log('失败:', numFailed.value)
    console.log('总尝试:', totalAttempts.value)
  }

  const stopLoad = async (): Promise<void> => {
    console.log('🛑 停止压测')

    const toStop = [...handles]
    handles = []

    await Promise.allSettled(
      toStop.map(async ({ session, ua }) => {
        try {
          if (session) {
            session.terminate()
          }
        } catch (e) {
          console.error('终止会话失败:', e)
        }

        try {
          if (ua) {
            ua.stop()
          }
        } catch (e) {
          console.error('停止 UA 失败:', e)
        }
      }),
    )

    isRunning.value = false
    console.log('✅ 压测已停止')
  }

  return {
    isRunning,
    startedAt,
    numActiveCalls,
    numSucceeded,
    numFailed,
    totalAttempts,
    progress,
    startLoad,
    stopLoad,
  }
}
