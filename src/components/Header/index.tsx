import React, { useMemo, useState } from 'react'
import { Box, Flex, Text } from 'rebass'
import { NavLink, withRouter } from 'react-router-dom'
import { SWPR } from '@swapr/sdk'
import { ChevronUp, ChevronDown } from 'react-feather'

import styled, { css } from 'styled-components'

import { useActiveWeb3React } from '../../hooks'
import { useDarkModeManager } from '../../state/user/hooks'
import { useNativeCurrencyBalance, useTokenBalance } from '../../state/wallet/hooks'
import { ReactComponent as GasInfoSvg } from '../../assets/svg/gas-info.svg'

import Settings from '../Settings'

import Row, { RowFixed, RowFlat } from '../Row'
import Web3Status from '../Web3Status'
import { useTranslation } from 'react-i18next'
import { ExternalLink } from '../../theme'
import MobileOptions from './MobileOptions'
import Badge from '../Badge'
import { useNativeCurrency } from '../../hooks/useNativeCurrency'
import SwaprVersionLogo from '../SwaprVersionLogo'
import { useToggleShowClaimPopup } from '../../state/application/hooks'
import ClaimModal from '../claim/ClaimModal'
import Skeleton from 'react-loading-skeleton'
import { useIsMobileByMedia } from '../../hooks/useIsMobileByMedia'
import { SwprInfo } from './swpr-info'
import { useSwaprSinglelSidedStakeCampaigns } from '../../hooks/singleSidedStakeCampaigns/useSwaprSingleSidedStakeCampaigns'

const HeaderFrame = styled.div`
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  width: 100%;
  padding: 1rem;
  ${({ theme }) => theme.mediaWidth.upToMedium`
    grid-template-columns: 1fr;
    width: calc(100%);
    position: relative;
  `};
`

const HeaderControls = styled.div<{ isConnected: boolean }>`
  ${({ theme }) => theme.mediaWidth.upToMedium`
    position: fixed;
    bottom: 0px;
    left: 0px;
    display: flex;
    align-items: center;
    justify-content: ${isConnected => (!isConnected ? 'space-between' : 'center')};
    flex-direction: row-reverse;
    width: 100%;
    height: 72px;
    max-width: 960px;
    padding: 1rem;
    z-index: 99;
    background-color: ${({ theme }) => theme.bg2};
  `};
`

const HeaderElement = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;

  ${({ theme }) => theme.mediaWidth.upToMedium`
    flex-direction: row-reverse;
    align-items: center;
    justify-content: center;
  `};
`

const MoreLinksIcon = styled(HeaderElement)`
  display: none;
  ${({ theme }) => theme.mediaWidth.upToSmall`
    display: flex;
    justify-content: flex-start;
  `};
`

const HeaderRow = styled(RowFixed)<{ isDark: boolean }>`
  ${({ theme }) => theme.mediaWidth.upToMedium`
    width: 100%;
  `};
`

const HeaderLinks = styled(Row)`
  justify-content: center;
  ${({ theme }) => theme.mediaWidth.upToMedium`
    justify-content: flex-end;
  `};
`

const Title = styled.a`
  display: flex;
  align-items: center;
  pointer-events: auto;
  justify-self: flex-start;
  margin-right: 12px;
  margin-left: 8px;
  ${({ theme }) => theme.mediaWidth.upToSmall`
    justify-self: center;
  `};
  ${({ theme }) => theme.mediaWidth.upToExtraSmall`
    margin-right: 0px;
  `};
  :hover {
    cursor: pointer;
  }
`

export const StyledNavLink = styled(NavLink)`
  ${({ theme }) => theme.flexRowNoWrap}
  align-items: left;
  border-radius: 3rem;
  outline: none;
  cursor: pointer;
  text-decoration: none;
  color: ${({ theme }) => theme.text5};
  width: fit-content;
  margin: 0 16px;
  font-weight: 400;
  font-size: 16px;
  line-height: 19.5px;

  &.active {
    font-weight: 600;
    color: ${({ theme }) => theme.white};
  }

  ${({ theme }) => theme.mediaWidth.upToLarge`
    margin: 0 8px;
  `};
  ${({ theme }) => theme.mediaWidth.upToSmall`
    display: none;
  `};
`

const StyledActiveNavLinkWithBadge = styled(StyledNavLink)`
  position: relative;
`

const AbsoluteBadgeFlex = styled(Flex)`
  position: absolute;
  top: 20px;
`

const StyledExternalLink = styled(ExternalLink)`
  ${({ theme }) => theme.flexRowNoWrap}
  align-items: left;
  outline: none;
  cursor: pointer;
  text-decoration: none;
  color: ${({ theme }) => theme.text5};
  font-weight: 400;
  font-size: 16px;
  line-height: 19.5px;
  width: fit-content;
  text-decoration: none !important;
  margin: 0 12px;
  ${({ theme }) => theme.mediaWidth.upToSmall`
    display: none;
  `};
`

const HeaderSubRow = styled(RowFlat)`
  align-items: center;
  justify-content: flex-end;
  margin-top: 10px;

  ${({ theme }) => theme.mediaWidth.upToMedium`
    margin-right: 8px;
    margin-top: 0px;
  `};
`

export const Amount = styled.p<{ clickable?: boolean; zero: boolean; borderRadius?: string }>`
  padding: 8px 12px;
  margin: 0;
  display: inline-flex;
  font-weight: bold;
  font-size: 10px;
  line-height: 12px;
  text-align: center;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.text4};
  background: ${({ theme }) => theme.bg1};
  border-radius: ${props => (props.borderRadius ? props.borderRadius : '12px')};
  cursor: ${props => (props.clickable ? 'pointer' : 'initial')};
  white-space: nowrap;
  ${props =>
    props.zero &&
    css`
      color: ${props => props.theme.red1};
      background: rgba(240, 46, 81, 0.2);
    `};

  & + & {
    margin-left: 7px;
  }
`
const GasInfo = styled.div`
  display: flex;
  margin-left: 6px;
  padding: 6px 8px;
  border: 1.06481px solid rgba(242, 153, 74, 0.65);
  background: rgba(242, 153, 74, 0.08);
  border-radius: 8px;
  font-size: 10px;
  font-weight: 600;
  color: #f2994a;
  align-items: center;
`
const GasColor = {
  fast: {
    color: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.3)'
  },
  normal: {
    color: '#F2994A',
    backgroundColor: 'rgba(242, 153, 74, 0.3);'
  },
  slow: {
    color: '#FF4F84',
    backgroundColor: 'rgba(255, 79, 132, 0.3);'
  }
}
const ColoredGas = styled.div<{ color: 'fast' | 'slow' | 'normal' }>`
  font-size: 10px;
  font-weight: 600;
  color: ${props => GasColor[props.color].color};
  background-color: ${props => GasColor[props.color].backgroundColor};
  padding: 3.19444px 4.25926px;

  border-radius: 4.25926px;
`

function Header() {
  const { account, chainId } = useActiveWeb3React()
  const { t } = useTranslation()
  const [isGasInfoOpen, setIsGasInfoOpen] = useState(false)
  const nativeCurrency = useNativeCurrency()
  const userNativeCurrencyBalance = useNativeCurrencyBalance()
  const [isDark] = useDarkModeManager()
  const { loading, data, stakedAmount } = useSwaprSinglelSidedStakeCampaigns()

  const toggleClaimPopup = useToggleShowClaimPopup()
  const accountOrUndefined = useMemo(() => account || undefined, [account])
  const newSwpr = useMemo(() => (chainId ? SWPR[chainId] : undefined), [chainId])
  const newSwprBalance = useTokenBalance(accountOrUndefined, newSwpr)
  const isMobileByMedia = useIsMobileByMedia()

  return (
    <HeaderFrame>
      <ClaimModal
        onDismiss={toggleClaimPopup}
        newSwprBalance={newSwprBalance}
        stakedAmount={stakedAmount}
        singleSidedCampaignLink={
          data && !loading ? `/rewards/${data.stakeToken.address}/${data.address}/singleSidedStaking` : undefined
        }
      />
      <HeaderRow isDark={isDark}>
        <Title href=".">
          <SwaprVersionLogo />
        </Title>
        <HeaderLinks>
          <StyledNavLink id="swap-nav-link" to="/swap" activeClassName="active">
            {t('swap')}
          </StyledNavLink>

          <StyledNavLink id="pool-nav-link" to="/pools" activeClassName="active">
            Liquidity
          </StyledNavLink>
          <StyledNavLink id="rewards-nav-link" to="/rewards" activeClassName="active">
            Rewards
          </StyledNavLink>
          <StyledActiveNavLinkWithBadge id="bridge-nav-link" to="/bridge" activeClassName="active">
            {t('bridge')}
            <AbsoluteBadgeFlex justifyContent="center" width="100%">
              <Box>
                <Badge label="BETA" />
              </Box>
            </AbsoluteBadgeFlex>
          </StyledActiveNavLinkWithBadge>
          <StyledExternalLink id="vote-nav-link" href={`https://snapshot.org/#/swpr.eth`}>
            {t('vote')}
          </StyledExternalLink>
          <StyledExternalLink id="stake-nav-link" href={`https://dxstats.eth.link/#/?chainId=${chainId}`}>
            {t('charts')}
            <Text ml="4px" fontSize="11px">
              ↗
            </Text>
          </StyledExternalLink>
          <MoreLinksIcon>
            <MobileOptions />
          </MoreLinksIcon>
          {isMobileByMedia && <Settings />}
        </HeaderLinks>
      </HeaderRow>
      <HeaderControls isConnected={!!account}>
        <HeaderElement>
          <Web3Status />
          {!isMobileByMedia && <Settings />}
        </HeaderElement>
        <HeaderSubRow>
          <SwprInfo
            hasActiveCampaigns={!loading && !!data}
            newSwprBalance={newSwprBalance}
            onToggleClaimPopup={toggleClaimPopup}
          />
          <Amount zero={!!userNativeCurrencyBalance?.equalTo('0')}>
            {!account ? (
              '0.000'
            ) : userNativeCurrencyBalance ? (
              userNativeCurrencyBalance?.toFixed(3)
            ) : (
              <Skeleton width="40px" />
            )}{' '}
            {nativeCurrency.symbol}
          </Amount>
          <GasInfo onClick={() => setIsGasInfoOpen(!isGasInfoOpen)}>
            <GasInfoSvg />
            <Text marginLeft={'4px'} marginRight={'2px'} fontSize={10} fontWeight={600}>
              97
            </Text>
            {isGasInfoOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </GasInfo>
        </HeaderSubRow>

        <HeaderSubRow style={{ visibility: isGasInfoOpen ? 'visible' : 'hidden', gap: '4px' }}>
          <ColoredGas color={'fast'}>FAST 119</ColoredGas>
          <ColoredGas color={'normal'}>NORMAL 97</ColoredGas>
          <ColoredGas color={'slow'}>SLOW 89</ColoredGas>
        </HeaderSubRow>
      </HeaderControls>
    </HeaderFrame>
  )
}

export default withRouter(Header)
