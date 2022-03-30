import { ArbitrumBridge } from './Arbitrum/ArbitrumBridge'
import { SocketBridge } from './Socket/SocketBridge'
import { GnosisBridge } from './Gnosis/GnosisBridge'
import { ChainId } from '@swapr/sdk'
import { EcoBridgeChildBase } from './EcoBridge.utils'

//supported chains are bidirectional
export const ecoBridgeConfig: EcoBridgeChildBase[] = [
  new ArbitrumBridge({
    bridgeId: 'arbitrum:testnet',
    displayName: 'Arbitrum',
    supportedChains: [{ from: ChainId.RINKEBY, to: ChainId.ARBITRUM_RINKEBY }]
  }),
  new ArbitrumBridge({
    bridgeId: 'arbitrum:mainnet',
    displayName: 'Arbitrum',
    supportedChains: [{ from: ChainId.MAINNET, to: ChainId.ARBITRUM_ONE }]
  }),
  new SocketBridge({
    bridgeId: 'socket',
    displayName: 'Socket',
    supportedChains: [
      { from: ChainId.MAINNET, to: ChainId.ARBITRUM_ONE },
      { from: ChainId.MAINNET, to: ChainId.XDAI },
      { from: ChainId.XDAI, to: ChainId.ARBITRUM_ONE }
    ]
  }),
  new GnosisBridge({
    bridgeId: 'omnibridge:eth-xdai',
    displayName: 'Gnosis',
    supportedChains: [{ from: ChainId.XDAI, to: ChainId.MAINNET }]
  })
]

export const ecoBridgePersistedKeys = ecoBridgeConfig.map(
  bridgeConfig => `ecoBridge.${bridgeConfig.bridgeId}.transactions`
)
