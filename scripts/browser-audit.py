"""Read-only browser and API regression audit against a running local app."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parents[1] / 'audit-results'
OUT.mkdir(exist_ok=True)
results = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    routes = ['/', '/dashboard', '/dashboard?asOf=2026-09-10', '/dashboard?asOf=bad', '/collections', '/pipeline', '/consultant', '/assistant', '/trace/00000000-0000-0000-0000-0000000000e1', '/trace/invalid', '/trace/00000000-0000-0000-0000-000000000000', '/health']
    for route in routes:
        response = page.goto('http://127.0.0.1:3000' + route, wait_until='networkidle', timeout=60000)
        text = page.locator('body').inner_text()
        results.append({'route': route, 'status': response.status, 'text': text[:1200], 'errors': list(errors)})
        assert response.status == (404 if route in ['/trace/invalid','/trace/00000000-0000-0000-0000-000000000000'] else 200), route
        assert not errors, (route, errors)
        errors.clear()
    page.goto('http://127.0.0.1:3000/assistant', wait_until='networkidle')
    students = page.locator('select option').evaluate_all('(els) => els.map(e => ({id:e.value,name:e.textContent}))')
    for student in students:
        for question in ["When's my next class?", "What's my balance?"]:
            response = page.request.post('http://127.0.0.1:3000/api/assistant', data={'studentId': student['id'], 'question': question}, timeout=60000)
            results.append({'student': student['name'], 'question': question, 'status': response.status, 'body': response.json()})
            assert response.status == 200 and response.json()['ok'], student['name']
    for endpoint, body in [('assistant', {'studentId': '-'*36, 'question':'balance'}), ('assistant', {}), ('consultant', {}), ('consultant', {'question':'x'*501}), ('consultant', {'question':"What's our total net profit?"}), ('consultant', {'question':"What's outstanding in collections right now?"})]:
        response = page.request.post('http://127.0.0.1:3000/api/'+endpoint, data=body, timeout=120000)
        results.append({'endpoint': endpoint, 'input':body, 'status':response.status, 'body':response.text()[:2000]})
        assert response.status == (200 if body.get('question') in ["What's our total net profit?", "What's outstanding in collections right now?"] else 400), body
    for route in ['/dashboard', '/collections', '/pipeline', '/consultant', '/assistant']:
        page.set_viewport_size({'width':390,'height':844})
        page.goto('http://127.0.0.1:3000'+route, wait_until='networkidle')
        overflow = page.evaluate('document.documentElement.scrollWidth > innerWidth')
        page.screenshot(path=str(OUT/(route[1:]+'-mobile.png')), full_page=True)
        results.append({'mobile':route,'overflow':overflow})
        assert not overflow, route
    browser.close()
(OUT/'browser.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(json.dumps(results,indent=2))
