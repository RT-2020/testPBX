import { ref } from 'vue'
import { UserAgent, Inviter, type UserAgentOptions, SessionState } from 'sip.js'

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
  ua: UserAgent
  inviter: Inviter
}

export const useSipLoadTester = () => {
  const isRunning = ref(false)
  const startedAt = ref<number | null>(null)
  const numActiveCalls = ref(0)
  const numSucceeded = ref(0)
  const numFailed = ref(0)
  const totalAttempts = ref(0)
  const progress = ref(0)

  let handles: CallHandle[] = []

  const createUA = (auth: SipAuth): UserAgent => {
    const uri = UserAgent.makeURI(auth.uri)
    if (!uri) throw new Error('Invalid SIP URI')
    const options: UserAgentOptions = {
      uri,
      transportOptions: { server: auth.wsServers },
      authorizationUsername: auth.authUser,
      authorizationPassword: auth.password,
      displayName: auth.displayName,
    }
    return new UserAgent(options)
  }

  const placeOneCall = async (
    auth: SipAuth,
    target: string,
    callSeconds: number,
    autoHangup: boolean,
  ) => {
    totalAttempts.value++
    let ua: UserAgent | null = null
    try {
      ua = createUA(auth)
      await ua.start()
    } catch (err) {
      numFailed.value++
      try {
        await ua?.stop()
      } catch {}
      return
    }
    const targetURI = UserAgent.makeURI(target)
    if (!targetURI) throw new Error('Invalid target')
    const inviter = new Inviter(ua, targetURI, {
      // 不携带本地 SDP，避免获取本地媒体；PBX 通常可兼容无 SDP 发起
      inviteWithoutSdp: true,
      sessionDescriptionHandlerOptions: {
        // 压测场景：不申请本地媒体，避免并发时浏览器权限/设备占用问题
        constraints: { audio: false, video: false },
      },
    })

    // 将句柄尽早加入，便于 stopLoad 能及时清理
    handles.push({ ua, inviter })

    numActiveCalls.value++
    let wasEstablished = false

    return new Promise<void>(async (resolve) => {
      inviter.stateChange.addListener(async (state) => {
        if (state === SessionState.Established) {
          numSucceeded.value++
          wasEstablished = true
          if (autoHangup) setTimeout(() => inviter.bye().catch(() => {}), callSeconds * 1000)
        }
        if (state === SessionState.Terminated) {
          numActiveCalls.value--
          if (!wasEstablished) numFailed.value++
          try {
            await ua.stop()
          } catch {}
          resolve()
        }
      })

      try {
        await inviter.invite()
      } catch {
        numFailed.value++
        numActiveCalls.value--
        try {
          await ua.stop()
        } catch {}
        resolve()
      }
    })
  }

  const startLoad = async (opts: LoadOptions) => {
    if (isRunning.value) return
    isRunning.value = true
    startedAt.value = Date.now()
    numActiveCalls.value = 0
    numSucceeded.value = 0
    numFailed.value = 0
    totalAttempts.value = 0
    progress.value = 0
    handles = []

    const jobs: Promise<void>[] = []
    for (let i = 0; i < opts.concurrent; i++)
      jobs.push(placeOneCall(opts.auth, opts.target, opts.callSeconds, opts.autoHangup))

    await Promise.all(jobs)
    isRunning.value = false
    progress.value = 100
  }

  const stopLoad = async () => {
    const toStop = [...handles]
    handles = []
    await Promise.allSettled(
      toStop.map(async ({ inviter, ua }) => {
        try {
          await inviter.bye()
        } catch {}
        try {
          await ua.stop()
        } catch {}
      }),
    )
    isRunning.value = false
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
