import json,sys
from playwright.sync_api import sync_playwright
URL='http://localhost:8080'
res=[];errs=[]
def check(name,ok,detail=''):
    res.append((name,bool(ok),detail)); print(('PASS ' if ok else 'FAIL ')+name+(' — '+str(detail) if detail else ''))
SNAP='(()=>{const g=window.game,s=g.state;return {x:s.player.x,y:s.player.y,time:s.time,paused:s.paused,inv:JSON.stringify(s.player.inventory||{}),chunks:(s.spawnedChunks||[]).length}})()'
def boot(pg):
    pg.goto(URL); pg.wait_for_function('window.game&&window.game.engine&&window.game.engine.frame>2&&window.game.state.ai',timeout=20000)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium',args=['--use-gl=swiftshader','--no-sandbox'])
    ctx=b.new_context(viewport={'width':1366,'height':800},accept_downloads=True)
    pg=ctx.new_page()
    pg.on('console',lambda m: errs.append(m.type+': '+m.text) if m.type in('error',) else None)
    pg.on('pageerror',lambda e: errs.append('pageerror: '+str(e)))
    boot(pg)
    check('fresh start opens in play at spawn',abs(pg.evaluate('game.state.player.x')-7.5)<.3)
    pg.mouse.click(683,400)
    pg.keyboard.press('e'); pg.wait_for_timeout(300)
    for k,t in [('d',700),('s',500)]:
        pg.keyboard.down(k); pg.wait_for_timeout(t); pg.keyboard.up(k)
    before=pg.evaluate(SNAP)
    check('collecting the crate changed the inventory',before['inv']!='{}',before['inv'][:80])
    pg.evaluate('game.action("save")'); pg.wait_for_timeout(600)
    pg.reload(); boot(pg)
    after=pg.evaluate(SNAP)
    check('reload resumes position',abs(after['x']-before['x'])<.6 and abs(after['y']-before['y'])<.6,f"{before['x']:.2f},{before['y']:.2f} -> {after['x']:.2f},{after['y']:.2f}")
    check('reload resumes inventory',after['inv']==before['inv'])
    # pause freezes simulation
    pg.mouse.click(683,400); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    t0=pg.evaluate('game.state.time'); pg.wait_for_timeout(1500); t1=pg.evaluate('game.state.time')
    check('pause freezes the clock',abs(t1-t0)<1e-6 and pg.evaluate('game.state.paused'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    check('Escape resumes',not pg.evaluate('game.state.paused'))
    # export
    with pg.expect_download() as d: pg.evaluate('game.action("export")')
    path=d.value.path(); data=json.load(open(path))
    check('export is a deadfall-save v1 envelope',data.get('format')=='deadfall-save' and data.get('version')==1,f"{d.value.suggested_filename}")
    exp=data['data']; ex,ey=exp['player']['x'],exp['player']['y']
    # move far away, then import the export
    pg.keyboard.down('a'); pg.wait_for_timeout(1500); pg.keyboard.up('a')
    moved=pg.evaluate(SNAP)
    check('player moved before import',abs(moved['x']-ex)>.5 or abs(moved['y']-ey)>.5)
    with pg.expect_navigation(): pg.set_input_files('#save-import-input',path)
    pg.wait_for_function('window.game&&window.game.engine&&window.game.engine.frame>2&&window.game.state.ai',timeout=20000)
    imp=pg.evaluate(SNAP)
    check('import restores the exported survivor (not overwritten by pagehide)',abs(imp['x']-ex)<.6 and abs(imp['y']-ey)<.6,f"export {ex:.2f},{ey:.2f} / after import {imp['x']:.2f},{imp['y']:.2f}")
    # corrupt import is rejected
    open('/tmp/bad.json','w').write('{"format":"nope"}')
    pg.set_input_files('#save-import-input','/tmp/bad.json'); pg.wait_for_timeout(800)
    check('corrupt import is rejected without losing the survivor',abs(pg.evaluate('game.state.player.x')-ex)<.6)
    # unreadable save is preserved, not overwritten
    pg.evaluate('localStorage.setItem("deadfall.save.v1","{broken")'); 
    b.close()
bad=[r for r in res if not r[1]]
print(f"\n{len(res)-len(bad)}/{len(res)} checks passed; console errors: {errs[:5]}")
