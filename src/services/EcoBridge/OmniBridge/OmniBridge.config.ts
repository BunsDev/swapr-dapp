import { BridgeConfig, BridgeOverrides } from './OmniBridge.types'

//official OmniBridge config
export const ETH_XDAI_BRIDGE_CONFIG = {
  label: 'eth⥊xdai',
  homeChainId: 100,
  foreignChainId: 1,
  enableReversedBridge: true,
  enableForeignCurrencyBridge: true,
  foreignMediatorAddress: '0x88ad09518695c6c3712AC10a214bE5109a655671'.toLowerCase(),
  homeMediatorAddress: '0xf6A78083ca3e2a662D6dd1703c939c8aCE2e268d'.toLowerCase(),
  foreignAmbAddress: '0x4C36d2919e407f0Cc2Ee3c993ccF8ac26d9CE64e'.toLowerCase(),
  homeAmbAddress: '0x75Df5AF045d91108662D8080fD1FEFAd6aA0bb59'.toLowerCase(),
  foreignGraphName: 'raid-guild/mainnet-omnibridge',
  homeGraphName: 'raid-guild/xdai-omnibridge',
  ambLiveMonitorPrefix: 'https://alm-xdai.herokuapp.com',
  claimDisabled: false,
  tokensClaimDisabled: [],
}

const OWLTokenOverride = {
  100: {
    mediator: '0xbeD794745e2a0543eE609795ade87A55Bbe935Ba',
    from: '0x0905Ab807F8FD040255F0cF8fa14756c1D824931',
    to: '0x1a5f9352af8af974bfc03399e3767df6370d82e4',
    mode: 'erc677',
  },
  1: {
    mediator: '0xed7e6720Ac8525Ac1AEee710f08789D02cD87ecB',
    from: '0x1a5f9352af8af974bfc03399e3767df6370d82e4',
    to: '0x0905Ab807F8FD040255F0cF8fa14756c1D824931',
    mode: 'dedicated-erc20',
  },
}

const LINKTokenOverride = {
  100: {
    mediator: '0xf6A78083ca3e2a662D6dd1703c939c8aCE2e268d',
    from: '0xE2e73A1c69ecF83F464EFCE6A5be353a37cA09b2',
    to: '0x514910771af9ca656af840dff83e8264ecf986ca',
    mode: 'erc677',
  },
  1: {
    mediator: '0x88ad09518695c6c3712AC10a214bE5109a655671',
    from: '0x514910771af9ca656af840dff83e8264ecf986ca',
    to: '0xE2e73A1c69ecF83F464EFCE6A5be353a37cA09b2',
    mode: 'erc677',
  },
}

const STAKETokenOverride = {
  100: {
    mediator: '0xf6A78083ca3e2a662D6dd1703c939c8aCE2e268d',
    from: '0xb7D311E2Eb55F2f68a9440da38e7989210b9A05e',
    to: '0x0Ae055097C6d159879521C384F1D2123D1f195e6',
    mode: 'erc677',
  },
  1: {
    mediator: '0x88ad09518695c6c3712AC10a214bE5109a655671',
    from: '0x0Ae055097C6d159879521C384F1D2123D1f195e6',
    to: '0xb7D311E2Eb55F2f68a9440da38e7989210b9A05e',
    mode: 'erc677',
  },
}

const MOONTokenOverride = {
  100: {
    mediator: '0xF75C28fE07E0647B05160288F172ad27CccD8f30',
    from: '0x1e16aa4Df73d29C029d94CeDa3e3114EC191E25A',
    to: '0xe1cA72ff3434B131765c62Cbcbc26060F7Aba03D',
    mode: 'erc677',
  },
  1: {
    mediator: '0xE7228B4EBAD37Ba031a8b63473727f991e262dCd',
    from: '0xe1cA72ff3434B131765c62Cbcbc26060F7Aba03D',
    to: '0x1e16aa4Df73d29C029d94CeDa3e3114EC191E25A',
    mode: 'erc677',
  },
}

const HNYTokenOverride = {
  100: {
    mediator: '0x0EeAcdb0Dd96588711581C5f3173dD55841b8e91',
    from: '0x71850b7e9ee3f13ab46d67167341e4bdc905eef9',
    to: '0xc3589f56b6869824804a5ea29f2c9886af1b0fce',
    mode: 'dedicated-erc20',
  },
  1: {
    mediator: '0x81A4833B3A40E7c61eFE9D1a287343797993B1E8',
    from: '0xc3589f56b6869824804a5ea29f2c9886af1b0fce',
    to: '0x71850b7e9ee3f13ab46d67167341e4bdc905eef9',
    mode: 'erc677',
  },
}

const DATATokenOverride = {
  100: {
    mediator: '0x53f3F44c434494da73EC44a6E8a8D091332bC2ce',
    from: '0x256eb8a51f382650B2A1e946b8811953640ee47D',
    to: '0x8f693ca8D21b157107184d29D398A8D082b38b76',
    mode: 'dedicated-erc20',
  },
  1: {
    mediator: '0x29e572d45cC33D5a68DCc8f92bfc7ded0017Bc59',
    from: '0x8f693ca8D21b157107184d29D398A8D082b38b76',
    to: '0x256eb8a51f382650B2A1e946b8811953640ee47D',
    mode: 'dedicated-erc20',
  },
}

const XDATATokenOverride = {
  100: {
    mediator: '0x7d55f9981d4E10A193314E001b96f72FCc901e40',
    from: '0xE4a2620edE1058D61BEe5F45F6414314fdf10548',
    to: '0x0cf0ee63788a0849fe5297f3407f701e122cc023',
    mode: 'dedicated-erc20',
  },
  1: {
    mediator: '0x2eeeDdeECe91c9F4c5bA4C8E1d784A0234C6d015',
    from: '0x0cf0ee63788a0849fe5297f3407f701e122cc023',
    to: '0xE4a2620edE1058D61BEe5F45F6414314fdf10548',
    mode: 'dedicated-erc20',
  },
}

const AGVETokenOverride = {
  100: {
    mediator: '0xBE20F60339b06Db32C319d46cf3Bc9bAcC0694aB',
    from: '0x3a97704a1b25f08aa230ae53b352e2e72ef52843',
    to: '0x0b006E475620Af076915257C6A9E40635AbdBBAd',
    mode: 'dedicated-erc20',
  },
  1: {
    mediator: '0x5689C65cfe5E8BF1A5F836c956DeA1b3B8BE00Bb',
    from: '0x0b006E475620Af076915257C6A9E40635AbdBBAd',
    to: '0x3a97704a1b25f08aa230ae53b352e2e72ef52843',
    mode: 'erc677',
  },
}

const SWASHTokenOverride = {
  100: {
    mediator: '0x68a64df7458a8eb2677991e657508fe00205332d',
    from: '0x84e2c67cbefae6b5148fca7d02b341b12ff4b5bb',
    to: '0xA130E3a33a4d84b04c3918c4E5762223Ae252F80',
    mode: 'erc677',
  },
  1: {
    mediator: '0xE964A36142BbE39751D0B4D6140fC0b8c48e68bE',
    from: '0xA130E3a33a4d84b04c3918c4E5762223Ae252F80',
    to: '0x84e2c67cbefae6b5148fca7d02b341b12ff4b5bb',
    mode: 'erc677',
  },
}

const UDTTokenOverride = {
  100: {
    mediator: '0x5F0FE58709639A39c193521d919aFaef02E570F7',
    from: '0x8C84142c4a716a16a89d0e61707164d6107A9811',
    to: '0x90de74265a416e1393a450752175aed98fe11517',
    mode: 'erc677',
  },
  1: {
    mediator: '0x41a4ee2855A7Dc328524babB07d7f505B201133e',
    from: '0x90de74265a416e1393a450752175aed98fe11517',
    to: '0x8C84142c4a716a16a89d0e61707164d6107A9811',
    mode: 'dedicated-erc20',
  },
}

const ETH_XDAI_OVERRIDES = {
  ['0x0905Ab807F8FD040255F0cF8fa14756c1D824931'.toLowerCase()]: OWLTokenOverride,
  ['0x1a5f9352af8af974bfc03399e3767df6370d82e4'.toLowerCase()]: OWLTokenOverride,
  ['0xE2e73A1c69ecF83F464EFCE6A5be353a37cA09b2'.toLowerCase()]: LINKTokenOverride,
  ['0x514910771af9ca656af840dff83e8264ecf986ca'.toLowerCase()]: LINKTokenOverride,
  ['0x0Ae055097C6d159879521C384F1D2123D1f195e6'.toLowerCase()]: STAKETokenOverride,
  ['0xb7D311E2Eb55F2f68a9440da38e7989210b9A05e'.toLowerCase()]: STAKETokenOverride,
  ['0xe1cA72ff3434B131765c62Cbcbc26060F7Aba03D'.toLowerCase()]: MOONTokenOverride,
  ['0x1e16aa4Df73d29C029d94CeDa3e3114EC191E25A'.toLowerCase()]: MOONTokenOverride,
  ['0xc3589f56b6869824804a5ea29f2c9886af1b0fce'.toLowerCase()]: HNYTokenOverride,
  ['0x71850b7e9ee3f13ab46d67167341e4bdc905eef9'.toLowerCase()]: HNYTokenOverride,
  ['0x8f693ca8D21b157107184d29D398A8D082b38b76'.toLowerCase()]: DATATokenOverride,
  ['0x256eb8a51f382650B2A1e946b8811953640ee47D'.toLowerCase()]: DATATokenOverride,
  ['0x0cf0ee63788a0849fe5297f3407f701e122cc023'.toLowerCase()]: XDATATokenOverride,
  ['0xE4a2620edE1058D61BEe5F45F6414314fdf10548'.toLowerCase()]: XDATATokenOverride,
  ['0x0b006E475620Af076915257C6A9E40635AbdBBAd'.toLowerCase()]: AGVETokenOverride,
  ['0x3a97704a1b25f08aa230ae53b352e2e72ef52843'.toLowerCase()]: AGVETokenOverride,
  ['0xA130E3a33a4d84b04c3918c4E5762223Ae252F80'.toLowerCase()]: SWASHTokenOverride,
  ['0x84e2c67cbefae6b5148fca7d02b341b12ff4b5bb'.toLowerCase()]: SWASHTokenOverride,
  ['0x90de74265a416e1393a450752175aed98fe11517'.toLowerCase()]: UDTTokenOverride,
  ['0x8C84142c4a716a16a89d0e61707164d6107A9811'.toLowerCase()]: UDTTokenOverride,
}

export const OVERRIDES: { [direction: string]: BridgeOverrides } = {
  'omnibridge:eth-xdai': ETH_XDAI_OVERRIDES,
}
export const BRIDGE_CONFIG: { [direction: string]: BridgeConfig } = {
  'omnibridge:eth-xdai': ETH_XDAI_BRIDGE_CONFIG,
}
