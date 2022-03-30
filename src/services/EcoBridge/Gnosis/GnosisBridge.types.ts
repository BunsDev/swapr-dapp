import { ChainId } from '@swapr/sdk'
import { TransactionReceipt } from '@ethersproject/abstract-provider'
import { BridgeTransactionSummary } from '../../../state/bridgeTransactions/types'

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
