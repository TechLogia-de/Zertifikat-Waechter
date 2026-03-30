import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Toast from '../Toast'
import type { ToastMessage } from '../Toast'

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing when toasts array is empty', () => {
    const { container } = render(<Toast toasts={[]} onDismiss={vi.fn()} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders a success toast with correct styling', () => {
    const toasts: ToastMessage[] = [
      { id: '1', type: 'success', message: 'Operation successful' },
    ]

    render(<Toast toasts={toasts} onDismiss={vi.fn()} />)

    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveTextContent('Operation successful')
    // Success toast uses green background
    expect(alert.className).toContain('bg-[#D1FAE5]')
  })

  it('renders an error toast with correct styling', () => {
    const toasts: ToastMessage[] = [
      { id: '1', type: 'error', message: 'Something went wrong' },
    ]

    render(<Toast toasts={toasts} onDismiss={vi.fn()} />)

    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveTextContent('Something went wrong')
    // Error toast uses red background
    expect(alert.className).toContain('bg-[#FEE2E2]')
  })

  it('renders multiple toasts', () => {
    const toasts: ToastMessage[] = [
      { id: '1', type: 'success', message: 'First toast' },
      { id: '2', type: 'error', message: 'Second toast' },
    ]

    render(<Toast toasts={toasts} onDismiss={vi.fn()} />)

    const alerts = screen.getAllByRole('alert')
    expect(alerts).toHaveLength(2)
  })

  it('auto-dismisses after 4 seconds', () => {
    const onDismiss = vi.fn()
    const toasts: ToastMessage[] = [
      { id: 'auto-1', type: 'success', message: 'Will auto-dismiss' },
    ]

    render(<Toast toasts={toasts} onDismiss={onDismiss} />)

    // Should not have been called yet
    expect(onDismiss).not.toHaveBeenCalled()

    // Advance past the 4-second auto-dismiss timer
    act(() => {
      vi.advanceTimersByTime(4000)
    })

    expect(onDismiss).toHaveBeenCalledWith('auto-1')
  })

  it('calls onDismiss when close button is clicked', () => {
    const onDismiss = vi.fn()
    const toasts: ToastMessage[] = [
      { id: 'dismiss-1', type: 'error', message: 'Close me' },
    ]

    render(<Toast toasts={toasts} onDismiss={onDismiss} />)

    const closeButton = screen.getByLabelText('Schließen')
    closeButton.click()

    expect(onDismiss).toHaveBeenCalledWith('dismiss-1')
  })
})
