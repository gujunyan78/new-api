/**
 * Bug Condition Exploration Test — Property 1
 *
 * Property: USDT 按钮应在"选择支付方式"区域内渲染，而非独立的"USDT 充值"区域。
 *
 * 这些测试在未修复代码上预期失败，确认 bug 存在。
 * 修复后，这些测试应全部通过。
 *
 * Requirements: 1.1, 1.2, 2.1, 2.2
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import fc from 'fast-check';
import RechargeCard from '../RechargeCard';

// --- Mocks ---

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key, i18n: { language: 'zh' } }),
}));

vi.mock('../../../helpers/render', () => ({
  getCurrencyConfig: () => ({ symbol: '$', rate: 1, type: 'USD' }),
}));

vi.mock('../SubscriptionPlansCard', () => ({
  default: () => null,
}));

vi.mock('../../../hooks/common/useMinimumLoadingTime', () => ({
  useMinimumLoadingTime: () => false,
}));

// --- Helpers ---

/** Minimal default props to render RechargeCard without crashing */
function makeProps(overrides = {}) {
  return {
    t: (key) => key,
    enableOnlineTopUp: false,
    enableStripeTopUp: false,
    enableCreemTopUp: false,
    enableWaffoTopUp: false,
    enableUsdtTopUp: false,
    creemProducts: [],
    creemPreTopUp: vi.fn(),
    presetAmounts: [],
    selectedPreset: null,
    selectPresetAmount: vi.fn(),
    formatLargeNumber: (n) => String(n),
    priceRatio: 1,
    topUpCount: 10,
    minTopUp: 1,
    renderQuotaWithAmount: (v) => `${v}`,
    getAmount: vi.fn(),
    setTopUpCount: vi.fn(),
    setSelectedPreset: vi.fn(),
    renderAmount: () => '$10',
    amountLoading: false,
    payMethods: [],
    preTopUp: vi.fn(),
    paymentLoading: false,
    payWay: '',
    redemptionCode: '',
    setRedemptionCode: vi.fn(),
    topUp: vi.fn(),
    isSubmitting: false,
    topUpLink: '',
    openTopUpLink: vi.fn(),
    userState: { user: { username: 'test', quota: 1000, request_count: 5 } },
    renderQuota: (v) => `${v}`,
    statusLoading: false,
    topupInfo: {},
    onOpenHistory: vi.fn(),
    waffoTopUp: vi.fn(),
    waffoPayMethods: [],
    usdtMinTopUp: 1,
    onUsdtPay: vi.fn(),
    subscriptionLoading: false,
    subscriptionPlans: [],
    billingPreference: 'payg',
    onChangeBillingPreference: vi.fn(),
    activeSubscriptions: [],
    ...overrides,
  };
}

/**
 * Arbitrary for payMethods arrays — generates combinations of
 * non-waffo payment methods to pair with USDT.
 */
const payMethodArb = fc.array(
  fc.record({
    type: fc.constantFrom('alipay', 'wxpay', 'stripe', 'bank'),
    name: fc.constantFrom('支付宝', '微信支付', 'Stripe', '银行卡'),
    icon: fc.constant(''),
    color: fc.constant(''),
    min_topup: fc.nat({ max: 100 }),
  }),
  { minLength: 0, maxLength: 4 },
);

// --- Tests ---

describe('Bug Condition Exploration — Property 1: USDT button placement', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('should NOT render a separate "USDT 充值" Form.Slot when enableUsdtTopUp=true (PBT)', () => {
    fc.assert(
      fc.property(payMethodArb, (payMethods) => {
        const { container, unmount } = render(
          <RechargeCard
            {...makeProps({
              enableUsdtTopUp: true,
              enableOnlineTopUp: payMethods.length > 0,
              payMethods,
            })}
          />,
        );

        // Bug condition: a separate Form.Slot with label "USDT 充值" should NOT exist.
        // On unfixed code this WILL exist — test expected to FAIL.
        const allLabels = container.querySelectorAll(
          '.semi-form-field-label-text',
        );
        const usdtLabel = Array.from(allLabels).find(
          (el) => el.textContent.trim() === 'USDT 充值',
        );

        unmount();

        expect(usdtLabel).toBeUndefined();
      }),
      { numRuns: 20 },
    );
  });

  it('should render USDT button inside "选择支付方式" area when enableUsdtTopUp=true with other pay methods (PBT)', () => {
    const nonEmptyPayMethodArb = fc.array(
      fc.record({
        type: fc.constantFrom('alipay', 'wxpay', 'stripe'),
        name: fc.constantFrom('支付宝', '微信支付', 'Stripe'),
        icon: fc.constant(''),
        color: fc.constant(''),
        min_topup: fc.constant(0),
      }),
      { minLength: 1, maxLength: 3 },
    );

    fc.assert(
      fc.property(nonEmptyPayMethodArb, (payMethods) => {
        const { container, unmount } = render(
          <RechargeCard
            {...makeProps({
              enableUsdtTopUp: true,
              enableOnlineTopUp: true,
              payMethods,
            })}
          />,
        );

        // Find ALL Form.Slot labels to locate the exact "选择支付方式" slot
        const allSlots = container.querySelectorAll('.semi-form-field');
        let payMethodSlot = null;
        for (const slot of allSlots) {
          const label = slot.querySelector('.semi-form-field-label-text');
          if (label && label.textContent.trim() === '选择支付方式') {
            payMethodSlot = slot;
            break;
          }
        }

        // Check that USDT button is a direct child button within this specific slot's Space
        // On unfixed code, USDT button lives in a separate "USDT 充值" Form.Slot
        const usdtButtonInPayMethodSlot = payMethodSlot
          ? Array.from(payMethodSlot.querySelectorAll('button')).find(
              (btn) => btn.textContent.trim() === 'USDT',
            )
          : null;

        // Also verify no separate "USDT 充值" slot exists
        let separateUsdtSlot = false;
        for (const slot of allSlots) {
          const label = slot.querySelector('.semi-form-field-label-text');
          if (label && label.textContent.trim() === 'USDT 充值') {
            separateUsdtSlot = true;
            break;
          }
        }

        unmount();

        expect(payMethodSlot).not.toBeNull();
        // On unfixed code, USDT button is NOT inside "选择支付方式" — test expected to FAIL.
        expect(usdtButtonInPayMethodSlot).not.toBeNull();
        // On unfixed code, separate "USDT 充值" slot exists — test expected to FAIL.
        expect(separateUsdtSlot).toBe(false);
      }),
      { numRuns: 20 },
    );
  });

  it('should show "选择支付方式" area when only USDT is enabled and payMethods is empty', () => {
    // Edge case: enableUsdtTopUp=true but no other pay methods.
    // On unfixed code, the Row and Col don't render because their conditions
    // don't include enableUsdtTopUp — test expected to FAIL.
    const { container } = render(
      <RechargeCard
        {...makeProps({
          enableUsdtTopUp: true,
          enableOnlineTopUp: false,
          enableStripeTopUp: false,
          enableWaffoTopUp: false,
          payMethods: [],
        })}
      />,
    );

    const allLabels = container.querySelectorAll(
      '.semi-form-field-label-text',
    );
    const payMethodLabel = Array.from(allLabels).find(
      (el) => el.textContent.trim() === '选择支付方式',
    );

    // On unfixed code, "选择支付方式" area won't render — test expected to FAIL.
    expect(payMethodLabel).toBeDefined();

    // And the USDT button should be inside it
    if (payMethodLabel) {
      const formSlot = payMethodLabel.closest('.semi-form-field');
      const usdtBtn = formSlot
        ? Array.from(formSlot.querySelectorAll('button')).find((btn) =>
            btn.textContent.includes('USDT'),
          )
        : null;
      expect(usdtBtn).not.toBeNull();
    }
  });
});
