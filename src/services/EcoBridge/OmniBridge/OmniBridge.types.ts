import { ChainId } from '@swapr/sdk'
import { TransactionReceipt } from '@ethersproject/abstract-provider'
import { BigNumber } from 'ethers'
import { EntityState } from '@reduxjs/toolkit'
import { TokenList } from '@uniswap/token-lists'
import { BridgeDetails, BridgingDetailsErrorMessage, SyncState } from '../EcoBridge.types'

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

export type TransactionMessage = {
  messageData: string | null
  messageId: string
  signatures: string[] | null
  txHash?: string
}

export type OmniBridgeTxn = {
  txHash: string
  assetName: string
  assetAddressL1?: string
  assetAddressL2?: string
  value: string
  fromChainId: ChainId
  toChainId: ChainId
  sender: string
  status: boolean | undefined | string
  timestampResolved?: number
  message?: TransactionMessage
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

export type InitialState = {
  transactions: EntityState<OmniBridgeTxn>
  lists: { [id: string]: TokenList }
  listsStatus: SyncState
  bridgingDetails: BridgeDetails
  bridgingDetailsStatus: SyncState
  lastMetadataCt: number
  bridgingDetailsErrorMessage?: BridgingDetailsErrorMessage
}
