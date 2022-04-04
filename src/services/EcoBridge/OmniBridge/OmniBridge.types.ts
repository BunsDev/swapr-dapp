import { ChainId } from '@swapr/sdk'
import { TransactionReceipt } from '@ethersproject/abstract-provider'
import { BridgeTransactionSummary } from '../../../state/bridgeTransactions/types'
import { BigNumber } from 'ethers'

export interface BridgeTxsSummary extends BridgeTransactionSummary {
  message?: {
    messageData: string | null
    messageId: string
    signatures: string[] | null
    txHash?: string
  }
  needsClaiming?: boolean
  receipt?: TransactionReceipt
}

export type TokenWithAddressAndChain = {
  chainId: ChainId
  address: string
}

export type TokenSubgraph = {
  address: string
  chainId: ChainId
  decimals: number
  name: string
  symbol: string
}

export type SubgraphResponse = {
  tokens: TokenSubgraph[]
}
export type Token = Pick<TokenSubgraph, 'address' | 'chainId' | 'name' | 'decimals'> & {
  mode?: string
  mediator?: string
}

export type PairTokens = {
  fromToken: Token & { amount: BigNumber; symbol?: string }
  toToken: Token
}

export type OmniBridgeTxn = {
  txHash: string
  assetName: string
  value: string
  fromChainId: ChainId
  toChainId: ChainId
  sender: string
  status: boolean | undefined | string
  timestampResolved?: number
  message?: {
    messageData: string | null
    messageId: string
    signatures: string[] | null
    txHash?: string
  }
  receipt?: TransactionReceipt
  needsClaiming?: boolean
  partnerTxHash?: string
}
export type Request = {
  amount: string
  decimals: number
  message: { txHash: string; messageId: string; signatures: string[]; messageData: string }
  messageId: string
  symbol: string
  timestamp: string
  token: string
  txHash: string
  user: string
}
export type Execution = {
  messageId: string
  status: boolean | undefined
  token: string
  txHash: string
}
export type SubgraphRequestsData = {
  requests: Request[]
}
export type SubgraphExecutionsData = {
  executions: Execution[]
}
