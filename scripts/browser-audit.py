"""Browser/security audit; only transient auth and rate-limit rows are written."""
import json
import os
import secrets
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parents[1] / 'audit-results'
OUT.mkdir(exist_ok=True)
BASE = os.environ.get('CONTINUUM_BASE_URL', 'http://localhost:3000').rstrip('/')
accounts = json.loads((OUT/'initial-accounts.json').read_text(encoding='utf8'))
results = []

def account(role, email=None):
    return next(a for a in accounts if a['role'] == role and (email is None or a['email'] == email))

def login(page, credentials):
    page.goto(BASE+'/login', wait_until='networkidle')
    page.get_by_label('Email address').fill(credentials['email'])
    page.get_by_label('Password', exact=True).fill(credentials['password'])
    page.get_by_role('button', name='Sign in', exact=True).click()
    page.wait_for_url(lambda url: '/login' not in url, timeout=60000)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    anon = browser.new_context(viewport={'width': 390, 'height': 844})
    page = anon.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))

    response = page.goto(BASE+'/login', wait_until='networkidle')
    assert response.status == 200
    assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
    required_headers = {
        'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
        'x-frame-options': 'DENY',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin-when-cross-origin',
        'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    }
    for name, expected in required_headers.items():
        assert response.headers.get(name) == expected, (name, response.headers.get(name))
    csp = response.headers.get('content-security-policy', '')
    for directive in ["default-src 'self'", "frame-ancestors 'none'", "worker-src 'self' blob:"]:
        assert directive in csp, directive
    icon_href = page.locator('link[rel="icon"][type="image/svg+xml"]').get_attribute('href')
    assert icon_href
    icon = anon.request.get(BASE+icon_href)
    assert icon.status == 200 and 'svg' in icon.headers.get('content-type', '')
    results.append({'check': 'security headers, mobile login, and favicon', 'pass': True})

    for route in ['/dashboard', '/accounts', '/assistant']:
        page.goto(BASE+route, wait_until='networkidle')
        assert '/login' in page.url, (route, page.url)
    for endpoint in ['assistant', 'consultant']:
        response = anon.request.post(BASE+'/api/'+endpoint, data={'question': 'balance'})
        assert response.status == 401, (endpoint, response.status)
    results.append({'check': 'anonymous pages and AI APIs blocked', 'pass': True})

    page.goto(BASE+'/forgot-password', wait_until='networkidle')
    page.get_by_label('Email address').fill(f'continuum-audit-{secrets.token_hex(6)}@example.com')
    page.get_by_role('button', name='Send new password', exact=True).click()
    generic = 'If that email is registered, a new temporary password has been sent to it.'
    page.get_by_text(generic, exact=True).wait_for(timeout=30000)
    results.append({'check': 'forgot-password anti-enumeration response', 'pass': True})

    hostile_passwords = ["' OR 1=1 --", '<script>window.pwned=true</script>', 'x'*128]
    for index, payload in enumerate(hostile_passwords):
        page.goto(BASE+'/login', wait_until='networkidle')
        page.get_by_label('Email address').fill(f'hostile-{index}@example.com')
        page.get_by_label('Password', exact=True).fill(payload)
        page.get_by_role('button', name='Sign in', exact=True).click()
        alert = page.locator('p[role="alert"]')
        alert.wait_for(timeout=30000)
        message = alert.inner_text()
        assert message == 'Email or password is incorrect.', (index, message)
        assert page.evaluate('window.pwned') is None
    assert not errors, errors
    results.append({'check': 'hostile login inputs fail generically without script execution', 'pass': True})
    anon.close()

    for email in ['student1@continuum.local', 'student2@continuum.local']:
        context = browser.new_context(viewport={'width': 390, 'height': 844})
        page = context.new_page()
        page_errors = []
        page.on('pageerror', lambda error, bucket=page_errors: bucket.append(str(error)))
        login(page, account('student', email))
        assert '/assistant' in page.url
        answers = []
        for question in ["When's my next class?", "What's my balance?"]:
            with page.expect_response(lambda r: '/api/assistant' in r.url, timeout=60000) as response_info:
                page.get_by_role('button', name=question, exact=True).click()
            response = response_info.value
            assert response.status == 200, (email, question, response.status)
            answer = response.json()['answer']
            answers.append(answer)
            assert 'TCS' not in answer
        assert 'no upcoming session' in answers[0].lower()
        assert '2,00,000' in answers[1] and '4,00,000' in answers[1]
        assert 'shared' in answers[1].lower() and not page.evaluate('document.documentElement.scrollWidth > innerWidth')
        assert not page_errors, (email, page_errors)
        page.get_by_role('button', name='Sign out', exact=True).click()
        page.wait_for_url('**/login', timeout=30000)
        results.append({'student': email, 'schedule': answers[0], 'balance': answers[1], 'pass': True})
        context.close()

    browser.close()

(OUT/'browser.json').write_text(json.dumps(results, indent=2), encoding='utf8')
print(json.dumps(results, indent=2))
