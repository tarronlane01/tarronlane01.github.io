import { useState } from 'react'
// Security rule testing requires raw Firestore access to verify that unauthorized
// reads/writes are actually rejected by Firestore rules. Using React Query would
// cache results and interfere with testing actual security behavior.
// eslint-disable-next-line no-restricted-imports
import { readDocByPath, updateDocByPath } from '@firestore'
import { useBudget } from '../../../contexts/budget_context'
import { Button, ErrorAlert } from '../../../components/ui'
import { pageSubtitle } from '../../../styles/shared'
import { logUserAction } from '@utils/actionLogger'
import { TestButton, TestSummary, type TestResult } from './TestsComponents'

// Test definitions
const TEST_DEFINITIONS = [
  { name: 'Read unauthorized budget', expectedToFail: true },
  { name: "Read another user's document", expectedToFail: true },
  { name: 'Read unauthorized budget month', expectedToFail: true },
  { name: 'Toggle is_admin in own permission_flags', expectedToFail: true },
  { name: 'Toggle is_test in own permission_flags', expectedToFail: true },
  { name: 'Read own user document', expectedToFail: false },
]

function Tests() {
  const { currentUserId } = useBudget()
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [isRunning, setIsRunning] = useState(false)

  function updateTestResult(name: string, updates: Partial<TestResult>) {
    setTestResults(prev => prev.map(t => t.name === name ? { ...t, ...updates } : t))
  }

  async function runTest(name: string, testFn: () => Promise<string>, expectedToFail: boolean) {
    updateTestResult(name, { status: 'running', message: 'Running...' })

    try {
      const message = await testFn()
      if (expectedToFail) {
        updateTestResult(name, { status: 'failed', message: `⚠️ ${message}` })
      } else {
        updateTestResult(name, { status: 'passed', message: `✓ ${message}` })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      if (expectedToFail) {
        updateTestResult(name, { status: 'passed', message: `✓ Blocked as expected: ${errorMessage}` })
      } else {
        updateTestResult(name, { status: 'failed', message: `✗ ${errorMessage}` })
      }
    }
  }

  async function runAllTests() {
    logUserAction('CLICK', 'Run All Security Tests')
    setIsRunning(true)
    setTestResults(TEST_DEFINITIONS.map(t => ({ ...t, status: 'pending', message: '' })))

    for (const test of TEST_DEFINITIONS) {
      await runTestByName(test.name)
    }

    setIsRunning(false)
  }

  async function runTestByName(name: string) {
    switch (name) {
      case 'Read unauthorized budget':
        await runTest(name, async () => {
          await readDocByPath('budgets', 'unauthorized_budget_test_12345', 'security test: attempting unauthorized budget read')
          return 'Was able to read budget (unexpected)'
        }, true)
        break
      case "Read another user's document":
        await runTest(name, async () => {
          await readDocByPath('users', 'another_user_test_12345', 'security test: attempting unauthorized user read')
          return 'Was able to read user document (unexpected)'
        }, true)
        break
      case 'Read unauthorized budget month':
        await runTest(name, async () => {
          const fakeMonthId = 'unauthorized_budget_test_12345_2024_01'
          await readDocByPath('months', fakeMonthId, 'security test: attempting unauthorized month read')
          return 'Was able to read month document for unauthorized budget (unexpected)'
        }, true)
        break
      case 'Toggle is_admin in own permission_flags':
        await runTest(name, async () => {
          if (!currentUserId) throw new Error('Not authenticated')
          const { data } = await readDocByPath<{ permission_flags?: { is_admin?: boolean } }>(
            'users', currentUserId, 'security test: reading own user to get current is_admin value'
          )
          const currentIsAdmin = data?.permission_flags?.is_admin ?? false
          await updateDocByPath('users', currentUserId, { 'permission_flags.is_admin': !currentIsAdmin },
            'security test: attempting to toggle is_admin (should fail)')
          return `Was able to change is_admin from ${currentIsAdmin} to ${!currentIsAdmin} (SECURITY ISSUE!)`
        }, true)
        break
      case 'Toggle is_test in own permission_flags':
        await runTest(name, async () => {
          if (!currentUserId) throw new Error('Not authenticated')
          const { data } = await readDocByPath<{ permission_flags?: { is_test?: boolean } }>(
            'users', currentUserId, 'security test: reading own user to get current is_test value'
          )
          const currentIsTest = data?.permission_flags?.is_test ?? false
          await updateDocByPath('users', currentUserId, { 'permission_flags.is_test': !currentIsTest },
            'security test: attempting to toggle is_test (should fail)')
          return `Was able to change is_test from ${currentIsTest} to ${!currentIsTest} (SECURITY ISSUE!)`
        }, true)
        break
      case 'Read own user document':
        await runTest(name, async () => {
          if (!currentUserId) throw new Error('Not authenticated')
          const { exists } = await readDocByPath('users', currentUserId, 'security test: reading own user document (should succeed)')
          if (exists) return 'Successfully read own document'
          throw new Error('Document does not exist')
        }, false)
        break
    }
  }

  async function runSingleTest(name: string) {
    logUserAction('CLICK', 'Run Security Test', { details: name })
    const existingTest = testResults.find(t => t.name === name)
    if (!existingTest) {
      setTestResults(prev => [...prev, { name, status: 'pending', message: '', expectedToFail: true }])
    }

    setIsRunning(true)
    await runTestByName(name)
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
        <Button onClick={runAllTests} disabled={isRunning} variant="primary">
          {isRunning ? 'Running Tests...' : 'Run All Tests'}
        </Button>
      </div>

      {testResults.length > 0 && <TestSummary totalCount={totalCount} passedCount={passedCount} failedCount={failedCount} />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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

export default Tests
