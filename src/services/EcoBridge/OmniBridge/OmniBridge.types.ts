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
  fromToken: Token & { amount: BigNumber }
  toToken: Token
}
