"""Exercises one authorized demo lifecycle; preserves its audit history."""
import json
import sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from urllib.request import urlopen
from playwright.sync_api import sync_playwright
out = Path('audit-results')
out.mkdir(exist_ok=True)
results = {}
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    if '--reuse' in sys.argv:
        results['created_trace'] = json.loads((out/'workflows.json').read_text(encoding='utf8'))['created_trace']
    else:
        page.goto('http://127.0.0.1:3000/pipeline', wait_until='networkidle')
        page.get_by_role('button',name='Run the lifecycle',exact=True).click()
        page.get_by_text('Net profit for the new batch',exact=True).wait_for(timeout=120000)
        assert '1,17,000' in page.locator('body').inner_text()
        results['created_trace'] = page.get_by_role('link',name='View trace').get_attribute('href')
    page.goto('http://127.0.0.1:3000'+results['created_trace'],wait_until='networkidle')
    page.get_by_role('heading',name='Enquiry → outcome').wait_for()
    results['trace_text'] = page.locator('body').inner_text()
    assert '1,17,000' in results['trace_text']
    assert 'lead.created' in results['trace_text']
    assert 'lead.converted' in results['trace_text']
    page.goto('http://127.0.0.1:3000/dashboard',wait_until='networkidle')
    date = page.get_by_label('Historical date')
    date.fill('2026-09-10')
    page.wait_for_url('**asOf=2026-09-10')
    page.get_by_role('button',name='Reset',exact=True).click()
    page.wait_for_url(lambda url: 'asOf=' not in url)
    results['date_apply_reset'] = True
    page.goto('http://127.0.0.1:3000/consultant',wait_until='networkidle')
    page.get_by_role('button',name="What's our total net profit?",exact=True).click()
    page.get_by_role('button',name='Export to Excel (.xlsx)',exact=True).wait_for(timeout=60000)
    with page.expect_download() as download:
        page.get_by_role('button',name='Export to Excel (.xlsx)',exact=True).click()
    download.value.save_as(str(out/'consultant-export.xlsx'))
    results['export_bytes'] = (out/'consultant-export.xlsx').stat().st_size
    page.get_by_role('button',name='SQL executed').click()
    assert page.locator('pre').count()==0
    results['sql_collapse'] = True
    browser.close()
def get_dashboard(_):
    with urlopen('http://127.0.0.1:3000/dashboard',timeout=60) as response:
        return response.status
with ThreadPoolExecutor(max_workers=10) as executor:
    results['concurrent_dashboard_statuses'] = list(executor.map(get_dashboard,range(20)))
assert all(s==200 for s in results['concurrent_dashboard_statuses'])
(out/'workflows.json').write_text(json.dumps(results,indent=2),encoding='utf8')
print(json.dumps(results,indent=2))
