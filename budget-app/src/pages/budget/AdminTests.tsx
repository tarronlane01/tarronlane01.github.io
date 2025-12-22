import { useState } from 'react'
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore'
import app from '../../firebase'
import { useBudget } from '../../contexts/budget_context'
import { Button, ErrorAlert } from '../../components/ui'
import { pageSubtitle, card, colors } from '../../styles/shared'

interface TestResult {
  name: string
  status: 'pending' | 'running' | 'passed' | 'failed'
  message: string
  expectedToFail: boolean
}

function AdminTests() {
  const { currentUserId } = useBudget()
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [isRunning, setIsRunning] = useState(false)

  const db = getFirestore(app)

  function updateTestResult(name: string, updates: Partial<TestResult>) {
    setTestResults(prev => prev.map(t => t.name === name ? { ...t, ...updates } : t))
  }

  async function runAllTests() {
    setIsRunning(true)
    setTestResults([])

    const tests: TestResult[] = [
      {
        name: 'Read unauthorized budget',
        status: 'pending',
        message: '',
        expectedToFail: true,
      },
      {
        name: 'Read another user\'s document',
        status: 'pending',
        message: '',
        expectedToFail: true,
      },
      {
        name: 'Read unauthorized budget month',
        status: 'pending',
        message: '',
        expectedToFail: true,
      },
      {
        name: 'Toggle is_admin in own permission_flags',
        status: 'pending',
        message: '',
        expectedToFail: true,
      },
      {
        name: 'Toggle is_test in own permission_flags',
        status: 'pending',
        message: '',
        expectedToFail: true,
      },
      {
        name: 'Read own user document',
        status: 'pending',
        message: '',
        expectedToFail: false,
      },
    ]

    setTestResults(tests)

    // Test 1: Try to read an unauthorized budget
    await runTest('Read unauthorized budget', async () => {
      // Use a fake budget ID that the user shouldn't have access to
      const fakeBudgetId = 'unauthorized_budget_test_12345'
      const budgetRef = doc(db, 'budgets', fakeBudgetId)
      await getDoc(budgetRef)
      return 'Was able to read budget (unexpected)'
    }, true)

    // Test 2: Try to read another user's document
    await runTest('Read another user\'s document', async () => {
      // Use a fake user ID
      const fakeUserId = 'another_user_test_12345'
      const userRef = doc(db, 'users', fakeUserId)
      await getDoc(userRef)
      return 'Was able to read user document (unexpected)'
    }, true)

    // Test 3: Try to read a month document for an unauthorized budget
    await runTest('Read unauthorized budget month', async () => {
      // Use a fake budget ID that the user shouldn't have access to
      // Month document IDs follow the format: {budgetId}_{year}_{month}
      const fakeBudgetId = 'unauthorized_budget_test_12345'
      const fakeMonthId = `${fakeBudgetId}_2024_01`
      const monthRef = doc(db, 'months', fakeMonthId)
      await getDoc(monthRef)
      return 'Was able to read month document for unauthorized budget (unexpected)'
    }, true)

    // Test 4: Try to toggle is_admin in own permission_flags
    await runTest('Toggle is_admin in own permission_flags', async () => {
      if (!currentUserId) throw new Error('Not authenticated')
      const userRef = doc(db, 'users', currentUserId)
      // First read current value
      const userDoc = await getDoc(userRef)
      const currentIsAdmin = userDoc.data()?.permission_flags?.is_admin ?? false
      // Try to set it to the opposite
      await updateDoc(userRef, {
        'permission_flags.is_admin': !currentIsAdmin,
      })
      return `Was able to change is_admin from ${currentIsAdmin} to ${!currentIsAdmin} (SECURITY ISSUE!)`
    }, true)

    // Test 5: Try to toggle is_test in own permission_flags
    await runTest('Toggle is_test in own permission_flags', async () => {
      if (!currentUserId) throw new Error('Not authenticated')
      const userRef = doc(db, 'users', currentUserId)
      // First read current value
      const userDoc = await getDoc(userRef)
      const currentIsTest = userDoc.data()?.permission_flags?.is_test ?? false
      // Try to set it to the opposite
      await updateDoc(userRef, {
        'permission_flags.is_test': !currentIsTest,
      })
      return `Was able to change is_test from ${currentIsTest} to ${!currentIsTest} (SECURITY ISSUE!)`
    }, true)

    // Test 6: Read own user document (should succeed)
    await runTest('Read own user document', async () => {
      if (!currentUserId) throw new Error('Not authenticated')
      const userRef = doc(db, 'users', currentUserId)
      const userDoc = await getDoc(userRef)
      if (userDoc.exists()) {
        return 'Successfully read own document'
      }
      throw new Error('Document does not exist')
    }, false)

    setIsRunning(false)
  }

  async function runTest(name: string, testFn: () => Promise<string>, expectedToFail: boolean) {
    updateTestResult(name, { status: 'running', message: 'Running...' })

    try {
      const message = await testFn()
      // If we expected it to fail but it succeeded, that's a problem
      if (expectedToFail) {
        updateTestResult(name, {
          status: 'failed',
          message: `⚠️ ${message}`,
        })
      } else {
        updateTestResult(name, {
          status: 'passed',
          message: `✓ ${message}`,
        })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      // If we expected it to fail and it did, that's good
      if (expectedToFail) {
        updateTestResult(name, {
          status: 'passed',
          message: `✓ Blocked as expected: ${errorMessage}`,
        })
      } else {
        updateTestResult(name, {
          status: 'failed',
          message: `✗ ${errorMessage}`,
        })
      }
    }
  }

  async function runSingleTest(name: string) {
    const existingTest = testResults.find(t => t.name === name)
    if (!existingTest) {
      // Add it to results if not present
      setTestResults(prev => [...prev, {
        name,
        status: 'pending',
        message: '',
        expectedToFail: true,
      }])
    }

    setIsRunning(true)

    switch (name) {
      case 'Read unauthorized budget':
        await runTest(name, async () => {
          const fakeBudgetId = 'unauthorized_budget_test_12345'
          const budgetRef = doc(db, 'budgets', fakeBudgetId)
          await getDoc(budgetRef)
          return 'Was able to read budget (unexpected)'
        }, true)
        break
      case 'Read another user\'s document':
        await runTest(name, async () => {
          const fakeUserId = 'another_user_test_12345'
          const userRef = doc(db, 'users', fakeUserId)
          await getDoc(userRef)
          return 'Was able to read user document (unexpected)'
        }, true)
        break
      case 'Read unauthorized budget month':
        await runTest(name, async () => {
          const fakeBudgetId = 'unauthorized_budget_test_12345'
          const fakeMonthId = `${fakeBudgetId}_2024_01`
          const monthRef = doc(db, 'months', fakeMonthId)
          await getDoc(monthRef)
          return 'Was able to read month document for unauthorized budget (unexpected)'
        }, true)
        break
      case 'Toggle is_admin in own permission_flags':
        await runTest(name, async () => {
          if (!currentUserId) throw new Error('Not authenticated')
          const userRef = doc(db, 'users', currentUserId)
          const userDoc = await getDoc(userRef)
          const currentIsAdmin = userDoc.data()?.permission_flags?.is_admin ?? false
          await updateDoc(userRef, {
            'permission_flags.is_admin': !currentIsAdmin,
          })
          return `Was able to change is_admin from ${currentIsAdmin} to ${!currentIsAdmin} (SECURITY ISSUE!)`
        }, true)
        break
      case 'Toggle is_test in own permission_flags':
        await runTest(name, async () => {
          if (!currentUserId) throw new Error('Not authenticated')
          const userRef = doc(db, 'users', currentUserId)
          const userDoc = await getDoc(userRef)
          const currentIsTest = userDoc.data()?.permission_flags?.is_test ?? false
          await updateDoc(userRef, {
            'permission_flags.is_test': !currentIsTest,
          })
          return `Was able to change is_test from ${currentIsTest} to ${!currentIsTest} (SECURITY ISSUE!)`
        }, true)
        break
      case 'Read own user document':
        await runTest(name, async () => {
          if (!currentUserId) throw new Error('Not authenticated')
          const userRef = doc(db, 'users', currentUserId)
          const userDoc = await getDoc(userRef)
          if (userDoc.exists()) {
            return 'Successfully read own document'
          }
          throw new Error('Document does not exist')
        }, false)
        break
    }

    setIsRunning(false)
  }

  const passedCount = testResults.filter(t => t.status === 'passed').length
  const failedCount = testResults.filter(t => t.status === 'failed').length
  const totalCount = testResults.length

  return (
    <div>
      <p style={pageSubtitle}>
        Run security tests to verify Firestore rules are working correctly.
        Tests that are expected to fail (blocked by security rules) should show as "passed".
      </p>

      <div style={{ marginBottom: '1.5rem' }}>
        <Button
          onClick={runAllTests}
          disabled={isRunning}
          variant="primary"
        >
          {isRunning ? 'Running Tests...' : 'Run All Tests'}
        </Button>
      </div>

      {testResults.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{
            display: 'flex',
            gap: '1rem',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            background: 'color-mix(in srgb, currentColor 5%, transparent)',
            marginBottom: '1rem',
          }}>
            <span>Total: <strong>{totalCount}</strong></span>
            <span style={{ color: colors.success }}>Passed: <strong>{passedCount}</strong></span>
            <span style={{ color: colors.danger }}>Failed: <strong>{failedCount}</strong></span>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Individual test buttons */}
        <h3 style={{ margin: '0.5rem 0' }}>Individual Tests</h3>

        <TestButton
          name="Read unauthorized budget"
          description="Try to read a budget the user doesn't have access to"
          expectedBehavior="Should be blocked by Firestore rules"
          result={testResults.find(t => t.name === 'Read unauthorized budget')}
          onRun={() => runSingleTest('Read unauthorized budget')}
          disabled={isRunning}
        />

        <TestButton
          name="Read another user's document"
          description="Try to read another user's profile document"
          expectedBehavior="Should be blocked by Firestore rules"
          result={testResults.find(t => t.name === "Read another user's document")}
          onRun={() => runSingleTest("Read another user's document")}
          disabled={isRunning}
        />

        <TestButton
          name="Read unauthorized budget month"
          description="Try to read a month document for a budget you don't have access to"
          expectedBehavior="Should be blocked - months inherit budget access"
          result={testResults.find(t => t.name === 'Read unauthorized budget month')}
          onRun={() => runSingleTest('Read unauthorized budget month')}
          disabled={isRunning}
        />

        <TestButton
          name="Toggle is_admin in own permission_flags"
          description="Try to change your admin privileges (toggles current value)"
          expectedBehavior="Should be blocked - permission_flags is protected"
          result={testResults.find(t => t.name === 'Toggle is_admin in own permission_flags')}
          onRun={() => runSingleTest('Toggle is_admin in own permission_flags')}
          disabled={isRunning}
        />

        <TestButton
          name="Toggle is_test in own permission_flags"
          description="Try to change your test privileges (toggles current value)"
          expectedBehavior="Should be blocked - permission_flags is protected"
          result={testResults.find(t => t.name === 'Toggle is_test in own permission_flags')}
          onRun={() => runSingleTest('Toggle is_test in own permission_flags')}
          disabled={isRunning}
        />

        <TestButton
          name="Read own user document"
          description="Read your own user profile document"
          expectedBehavior="Should succeed - users can read their own data"
          result={testResults.find(t => t.name === 'Read own user document')}
          onRun={() => runSingleTest('Read own user document')}
          disabled={isRunning}
          expectedToSucceed
        />
      </div>

      {failedCount > 0 && (
        <ErrorAlert style={{ marginTop: '1.5rem' }}>
          ⚠️ {failedCount} test(s) failed! This may indicate a security vulnerability in your Firestore rules.
        </ErrorAlert>
      )}
    </div>
  )
}

interface TestButtonProps {
  name: string
  description: string
  expectedBehavior: string
  result?: TestResult
  onRun: () => void
  disabled: boolean
  expectedToSucceed?: boolean
}

function TestButton({ name, description, expectedBehavior, result, onRun, disabled, expectedToSucceed }: TestButtonProps) {
  const statusColor = result?.status === 'passed'
    ? colors.success
    : result?.status === 'failed'
      ? colors.danger
      : result?.status === 'running'
        ? colors.warning
        : 'inherit'

  return (
    <div style={{
      ...card,
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{name}</h4>
          <p style={{ margin: '0.25rem 0 0', opacity: 0.7, fontSize: '0.85rem' }}>{description}</p>
          <p style={{
            margin: '0.25rem 0 0',
            fontSize: '0.8rem',
            color: expectedToSucceed ? colors.success : colors.warning,
          }}>
            Expected: {expectedBehavior}
          </p>
        </div>
        <Button
          onClick={onRun}
          disabled={disabled}
          variant="secondary"
          style={{ flexShrink: 0 }}
        >
          {result?.status === 'running' ? '⏳' : 'Run'}
        </Button>
      </div>

      {result && result.status !== 'pending' && (
        <div style={{
          padding: '0.5rem 0.75rem',
          borderRadius: '6px',
          background: `color-mix(in srgb, ${statusColor} 15%, transparent)`,
          border: `1px solid color-mix(in srgb, ${statusColor} 30%, transparent)`,
          fontSize: '0.85rem',
          color: statusColor,
        }}>
          {result.message}
        </div>
      )}
    </div>
  )
}

export default AdminTests

