export interface RequestToken {
  requestId: number
  revision: number
}

export function createRequestGate() {
  let nextRequestId = 0
  let lastAppliedRequestId = 0
  let revision = 0

  return {
    begin(): RequestToken {
      return { requestId: ++nextRequestId, revision }
    },
    invalidate() {
      revision += 1
    },
    canApply(token: RequestToken) {
      if (token.revision !== revision || token.requestId < lastAppliedRequestId) return false
      lastAppliedRequestId = token.requestId
      return true
    },
  }
}
