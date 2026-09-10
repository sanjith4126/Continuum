"""Authenticated browser matrix; no business records are created."""
import json,os,secrets
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path('audit-results');BASE=os.environ.get('CONTINUUM_BASE_URL','http://localhost:3000').rstrip('/')
accounts=json.loads((OUT/'initial-accounts.json').read_text(encoding='utf8'))
allowed={
 'management':['/dashboard','/crm','/training','/finance','/collections','/consultant','/accounts','/pipeline'],
 'sales':['/crm'], 'ops':['/training'], 'finance':['/dashboard','/finance','/collections','/consultant'],
 'trainer':['/training'], 'student':['/assistant']}
routes=['/dashboard','/crm','/training','/finance','/collections','/consultant','/accounts','/pipeline','/assistant']
results=[]
def save(): (OUT/'role-tests.json').write_text(json.dumps(results,indent=2),encoding='utf8')
def api_post(page, endpoint, body):
 return page.evaluate("""async ({endpoint, body}) => {
  const response = await fetch('/api/' + endpoint, {
   method: 'POST',
   headers: {'Content-Type': 'application/json'},
   body: JSON.stringify(body)
  });
  return {status: response.status, text: await response.text()};
 }""", {'endpoint': endpoint, 'body': body})
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 anon=browser.new_context();page=anon.new_page()
 for route in routes:
  page.goto(BASE+route,wait_until='networkidle',timeout=60000);assert '/login' in page.url,route
 for endpoint in ['assistant','consultant']:
  response=page.request.post(BASE+'/api/'+endpoint,data={'question':'balance'});assert response.status==401
 results.append({'check':'anonymous pages and APIs blocked','pass':True});save();anon.close()
 for a in accounts:
  context=browser.new_context(viewport={'width':1440,'height':1000});page=context.new_page();errors=[]
  page.on('pageerror',lambda error:errors.append(str(error)))
  page.goto(BASE+'/login',wait_until='networkidle')
  page.get_by_label('Email address').fill(a['email']);page.get_by_label('Password',exact=True).fill(a['password']);page.get_by_role('button',name='Sign in',exact=True).click()
  page.wait_for_url(lambda u:'/login' not in u,timeout=60000)
  if '/account' in page.url:
   new=secrets.token_urlsafe(20)
   page.get_by_label('Current password',exact=True).fill(a['password']);page.get_by_label('New password',exact=True).fill(new);page.get_by_label('Confirm new password',exact=True).fill(new)
   page.get_by_role('button',name='Update password').click();page.wait_for_url('**/login?changed=1',timeout=60000)
   a['password']=new;(OUT/'initial-accounts.json').write_text(json.dumps(accounts,indent=2),encoding='utf8')
   page.get_by_label('Email address').fill(a['email']);page.get_by_label('Password',exact=True).fill(new);page.get_by_role('button',name='Sign in',exact=True).click();page.wait_for_url(lambda u:'/login' not in u,timeout=60000)
  for route in routes:
   page.goto(BASE+route,wait_until='networkidle',timeout=60000)
   if route in allowed[a['role']]:
    assert '/forbidden' not in page.url and '/login' not in page.url,(a['role'],route,page.url)
    assert 'Application error' not in page.locator('body').inner_text(),(a['role'],route)
   else:assert '/forbidden' in page.url,(a['role'],route,page.url)
  for endpoint in ['assistant','consultant']:
   permitted=(a['role']=='student' if endpoint=='assistant' else a['role'] in ['management','finance'])
   response=api_post(page,endpoint,{'question':''})
   assert response['status']==(400 if permitted else 403),(a['role'],endpoint,response['status'],response['text'])
  if a['role']=='student':
   response=api_post(page,'assistant',{'question':'balance','studentId':'00000000-0000-0000-0000-0000000000a5'})
   assert response['status']==400
  page.goto(BASE+allowed[a['role']][0],wait_until='networkidle')
  page.screenshot(path=str(OUT/(a['role']+'-desktop.png')),full_page=True)
  page.set_viewport_size({'width':390,'height':844})
  assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'),a['role']
  page.screenshot(path=str(OUT/(a['role']+'-mobile-new.png')),full_page=True)
  assert not errors,(a['role'],errors)
  page.get_by_role('button',name='Sign out',exact=True).click();page.wait_for_url('**/login',timeout=30000)
  response=page.request.post(BASE+'/api/assistant',data={'question':''});assert response.status==401
  results.append({'role':a['role'],'email':a['email'],'routesChecked':len(routes),'pass':True});save();context.close()
 browser.close()
print(json.dumps(results,indent=2))
