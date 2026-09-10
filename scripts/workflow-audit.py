"""Exercises one authorized demo lifecycle; preserves its audit history."""
import json
import os
import sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from urllib.request import Request, urlopen
from playwright.sync_api import sync_playwright
out = Path('audit-results')
out.mkdir(exist_ok=True)
results = {}
base = os.environ.get('CONTINUUM_BASE_URL', 'http://localhost:3000').rstrip('/')
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()
    management = next(account for account in json.loads((out/'initial-accounts.json').read_text(encoding='utf8')) if account['role'] == 'management')
    page.goto(base+'/login', wait_until='networkidle')
    page.get_by_label('Email address').fill(management['email'])
    page.get_by_label('Password', exact=True).fill(management['password'])
    page.get_by_role('button', name='Sign in', exact=True).click()
    page.wait_for_url('**/dashboard', timeout=60000)
    if '--reuse' in sys.argv:
        results['created_trace'] = '/trace/00000000-0000-0000-0000-0000000000e1'
        expected_margin = '1,40,000'
    else:
        page.goto(base+'/pipeline', wait_until='networkidle')
        page.get_by_role('button',name='Run the lifecycle',exact=True).click()
        page.get_by_text('Net profit for the new batch',exact=True).wait_for(timeout=120000)
        assert '1,17,000' in page.locator('body').inner_text()
        results['created_trace'] = page.get_by_role('link',name='View trace').get_attribute('href')
        expected_margin = '1,17,000'
    page.goto(base+results['created_trace'],wait_until='networkidle')
    page.get_by_role('heading',name='Enquiry → outcome').wait_for()
    results['trace_text'] = page.locator('body').inner_text()
    assert expected_margin in results['trace_text']
    assert 'lead.created' in results['trace_text']
    assert 'lead.converted' in results['trace_text']
    page.goto(base+'/dashboard',wait_until='networkidle')
    date = page.get_by_label('Historical date')
    date.fill('2026-09-10')
    page.wait_for_url('**asOf=2026-09-10')
    page.get_by_role('button',name='Reset',exact=True).click()
    page.wait_for_url(lambda url: 'asOf=' not in url)
    results['date_apply_reset'] = True
    page.goto(base+'/consultant',wait_until='networkidle')
    assert page.url == base+'/consultant', (page.url, page.locator('body').inner_text()[:500])
    assert page.get_by_role('button',name="What's our total net profit?",exact=True).count() == 1, page.locator('body').inner_text()[:1000]
    page.get_by_role('button',name="What's our total net profit?",exact=True).click()
    page.get_by_role('button',name='Export to Excel (.xlsx)',exact=True).wait_for(timeout=60000)
    with page.expect_download() as download:
        page.get_by_role('button',name='Export to Excel (.xlsx)',exact=True).click()
    download.value.save_as(str(out/'consultant-export.xlsx'))
    results['export_bytes'] = (out/'consultant-export.xlsx').stat().st_size
    page.get_by_role('button',name='SQL executed').click()
    assert page.locator('pre').count()==0
    results['sql_collapse'] = True
    cookie_header = '; '.join(f"{cookie['name']}={cookie['value']}" for cookie in context.cookies())
    def get_dashboard(_):
        request = Request(base+'/dashboard', headers={'Cookie': cookie_header})
        with urlopen(request,timeout=60) as response:
            return response.status
    with ThreadPoolExecutor(max_workers=10) as executor:
        results['concurrent_dashboard_statuses'] = list(executor.map(get_dashboard,range(20)))
    assert all(s==200 for s in results['concurrent_dashboard_statuses'])
    page.goto(base+'/dashboard', wait_until='networkidle')
    page.get_by_role('button', name='Sign out', exact=True).click()
    page.wait_for_url('**/login', timeout=30000)
    browser.close()
(out/'workflows.json').write_text(json.dumps(results,indent=2),encoding='utf8')
print(json.dumps(results,indent=2))
