import { _10000 } from '@swapr/sdk'

import { Trans } from 'react-i18next'
import { useTheme } from 'styled-components'

import { useActiveWeb3React } from '../../hooks'
import { TYPE } from '../../theme'
import { limitNumberOfDecimalPlaces } from '../../utils/prices'
import { UnderlinedSmallText, UppercaseHelper } from './CurrencyInputPanel.styles'
import { CurrencyUserBalanceProps } from './CurrencyInputPanel.types'

export const CurrencyUserBalance = ({
  hideBalance,
  currency,
  pair,
  balance,
  selectedCurrencyBalance,
  customBalanceText,
  onMax,
}: CurrencyUserBalanceProps) => {
  const { account } = useActiveWeb3React()
  const theme = useTheme()

  if (!account) return null

  const availableBalance = balance || selectedCurrencyBalance

  const trimmedBalance: string = availableBalance?.greaterThan(_10000)
    ? availableBalance.toFixed(2)
    : limitNumberOfDecimalPlaces(availableBalance) || '0'

  return (
    <TYPE.Body
      onClick={onMax}
      fontWeight="600"
      fontSize="10px"
      lineHeight="13px"
      letterSpacing="0.08em"
      style={{
        display: 'inline',
        marginLeft: 'auto',
        cursor: !hideBalance && !!(currency || pair) && availableBalance ? 'pointer' : 'auto',
      }}
    >
      <UppercaseHelper>
        {!hideBalance && !!(currency || pair) && availableBalance && (
          <>
            {customBalanceText ? (
              <>
                {customBalanceText}
                <UnderlinedSmallText as="span" color="text3" fontWeight={600}>
                  {trimmedBalance}
                </UnderlinedSmallText>
              </>
            ) : (
              <Trans
                i18nKey="swap:currencyUserBalance.balance"
                values={{
                  balanceInput: trimmedBalance,
                }}
                components={[
                  <span
                    key="1"
                    style={{
                      fontSize: '11px',
                      color: theme.text3,
                      fontWeight: 600,
                      textDecoration: 'underline',
                    }}
                  ></span>,
                ]}
              />
            )}
          </>
        )}
      </UppercaseHelper>
    </TYPE.Body>
  )
}
