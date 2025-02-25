import { transparentize } from 'polished'
import styled, { useTheme } from 'styled-components'

import { DarkCard } from '../components/Card'

export const BodyWrapper = styled(DarkCard)<{ tradeDetailsOpen?: boolean }>`
  position: relative;
  max-width: 457px;
  width: 100%;
  border-radius: 12px;
  padding: 12px;
  transition: box-shadow 0.3s ease;
  z-index: 1;
  ::before {
    border-radius: 12px;
    background: linear-gradient(
        130.17deg,
        ${props => transparentize(0.75, props.theme.white)} -5.69%,
        ${props => transparentize(1, props.theme.black)} 106.79%
      ),
      ${props => props.theme.dark1};
    background: ${props => props.theme.dark1};
  }
`

interface AppBodyProps {
  tradeDetailsOpen?: boolean
  children: React.ReactNode
}

/**
 * The styled container element that wraps the content of most pages and the tabs.
 */
export default function AppBody({ children, tradeDetailsOpen }: AppBodyProps) {
  const theme = useTheme()
  return (
    <BodyWrapper backgroundColor={theme.bg1} tradeDetailsOpen={tradeDetailsOpen}>
      {children}
    </BodyWrapper>
  )
}
