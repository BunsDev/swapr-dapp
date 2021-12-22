import { ChainId } from '@swapr/sdk'
import { INFURA_PROJECT_ID } from '../../connectors'
import { NETWORK_DETAIL } from '../../constants'
import { JsonRpcProvider, Web3Provider } from '@ethersproject/providers'

const addInfuraKey = (rpcUrl: string) => {
  if (rpcUrl.includes('infura')) {
    let updatedUrl = rpcUrl

    if (!rpcUrl.endsWith('/')) {
      updatedUrl = rpcUrl + '/'
    }

    return updatedUrl + INFURA_PROJECT_ID
  }

  return rpcUrl
}

export type BridgeProviders = {
  [key in ChainId]?: JsonRpcProvider | Web3Provider
}

export const initiateBridgeProviders = (): BridgeProviders => ({
  [ChainId.ARBITRUM_ONE]: new JsonRpcProvider(addInfuraKey(NETWORK_DETAIL[ChainId.ARBITRUM_ONE].rpcUrls[0])),
  [ChainId.ARBITRUM_RINKEBY]: new JsonRpcProvider(addInfuraKey(NETWORK_DETAIL[ChainId.ARBITRUM_RINKEBY].rpcUrls[0])),
  // [ChainId.BSC]: new JsonRpcProvider(addInfuraKey(NETWORK_DETAIL[ChainId.BSC].rpcUrls[0])),
  // [ChainId.BSC_TESTNET]: new JsonRpcProvider(addInfuraKey(NETWORK_DETAIL[ChainId.BSC_TESTNET].rpcUrls[0])),
  // [ChainId.KOVAN]: new JsonRpcProvider(addInfuraKey(NETWORK_DETAIL[ChainId.KOVAN].rpcUrls[0])),
  [ChainId.RINKEBY]: new JsonRpcProvider(addInfuraKey(NETWORK_DETAIL[ChainId.RINKEBY].rpcUrls[0])),
  // [ChainId.SOKOL]: new JsonRpcProvider(addInfuraKey(NETWORK_DETAIL[ChainId.SOKOL].rpcUrls[0])),
  [ChainId.XDAI]: new JsonRpcProvider(addInfuraKey(NETWORK_DETAIL[ChainId.XDAI].rpcUrls[0]))
})
