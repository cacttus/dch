//backend / server

//=================================================================

let init_tab = undefined
let pending = []
let active = new Map()

//=================================================================

function send(m, d) {
  if (init_tab) {
    vdbg("Server sending m:" + m + " d:" + d + " init_tab=" + init_tab)
    const sending = browser.tabs.sendMessage(
      init_tab,
      { _msg: m, _data: d }
    )
  }
  else {
    err("Tried to send data but the tab init was not had")
  }
}
async function handle_message(m, sndr, resp) {
  try {
    vdbg("Client:" + JSON.stringify(m))
    switch (m._msg) {
      case Msg.inittab:
        init_tab = sndr.tab.id //resp //save comm channel to init tab
        send(Msg.dbg, 'Registered tab id=' + init_tab)
        break;
      case Msg.saveFile:
      case Msg.saveFileAs:
        let fn = m._data.split('/').pop()
        vdbg("Queueing " + fn + "(" + m._data + ")")

        pending.push({ _fn: fn, _url: m._data, _saveAs: (m._msg === Msg.saveFileAs) })
        break;
      default:
        err("Inavlid message " + JSON.stringify(m))
        send(Msg.err, "Inavlid message " + JSON.stringify(m))
        break;
    }
  }
  catch (e) {
    err(e)
  }
}

//=================================================================

init_script(() => {
  browser.downloads.onCreated.addListener((itm) => {
    active.set(itm.id, itm)
  })
  browser.downloads.onChanged.addListener((dld) => {
    if (dld.state && (dld.state.current === "complete" || dld.state.current === "interrupted")) {
      let itm = active.get(dld.id)
      if (itm) {
        active.delete(dld.id)
      }
      else {
        msg("DL not found")
      }
    }
    //TODO:
    //browser.downloads.showDefaultFolder();

  })
  browser.runtime.onMessage.addListener(handle_message);
  browser.commands.onCommand.addListener((command) => {
    switch (command) {
      case Msg.saveAll: send(Msg.saveAll, ""); break;
      case Msg.saveAllAs: send(Msg.saveAllAs, ""); break;
      default:
        err("invalid command " + JSON.stringify(command))
        break;
    }
  });
  browser.tabs.onUpdated.addListener(() => {
  });

  window.setInterval(async () => {
    while ((pending.length > 0) && (S.max_concurrent_downloads <= 0 || (active.size < S.max_concurrent_downloads))) {
      let dl = pending.splice(0, 1)[0]

      let nam = "" + dl._fn + " (" + dl._url + ")"
      if (!isdebug() || (isdebug() && !S.debug_disable_download)) {
        dbg(nam)
        let dlid = await browser.downloads.download({
          url: dl._url,
          filename: dl._fn,// Absolute paths, empty paths, path components that start and/or end with a dot (.), and paths containing back-references (../) will cause an error. 
          saveAs: dl._saveAs, //SaveAs - "always ask where to save files" in prefs turn this off and its faster
          conflictAction: 'overwrite' //'overwrite' //uniquify prompt
        })
        if (!active.get(dlid)) {
          active.set(dlid, null)
        }
      }
      else {
        wrn(nam + " (Download is disabled)")
      }
      if (S.download_delay_ms > 0) {
        await sleep(S.download_delay_ms)
      }

    }

  }, 200)
  window.setInterval(async () => {
    msg(" pending:" + pending.length + " active:" + active.size)
  }, S.debug ? 500 : 3000)

})

