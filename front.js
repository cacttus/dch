//frontend / webpage

//=================================================================

let alt_down = false

//=================================================================

function send(msg, data) {
  browser.runtime.sendMessage({ _msg: msg, _data: data }).then(handle_message, RPCError);
}
async function get_files(ele, files) {
  msg("searching for files..")
  let start_time = new Date();
  if (ele != null) {
    let dir = 0
    let count = 99999999

    if (filter_tag(ele)) {
      count = 1
    }
    else if (S.enable_global) {
      ele = document.body
      dir = 1
    }

    await _get_files(ele, files, start_time, dir, tag_depth(ele), count)
  }
  return (new Date()) - start_time;
}
async function _get_files(ele, files, start_time, dir, depth, count) {
  if (ele != null) {
    let elapsed = (new Date()) - start_time;
    if (S.query_timeout_ms > 0 && elapsed > S.query_timeout_ms) {
      Raise("getFiles timed out")
    }
    vdbg("  ".repeat(Math.max(0, depth)) + ele.tagName + " (" + elapsed / 1000 + "s)")

    if (!await is_thumb(ele, files)) {
      await check_tag(ele, files)
      if (files.size < count) {
        if (dir < 0) {
          await _get_files(ele.parentElement, files, start_time, dir, depth - 1, count)
        }
        if (dir > 0) {
          for (let i = 0; i < ele.children.length; i++) {
            await _get_files(ele.children[i], files, start_time, dir, depth + 1, count)
          }
        }
      }
    }
  }
}
async function is_thumb(ele, files) {
  if (ele.tagName.toLowerCase() === "img" && S.thumb_search_depth > 0) {
    let p = find_parent_tag(ele, "a", S.thumb_search_depth)
    if (p != null) {
      vdbg("Tag was a thumbnail")
      await check_tag(p, files)
      return true
    }
  }
  return false
}
async function check_tag(ele, files) {
  let url = ""
  if (filter_tag(ele)) {
    if (ele.hasAttribute("href")) {
      url = ele.href
    }
    else if (ele.hasAttribute("src")) {
      url = ele.src
    }
    else {
      err("tag " + ele.tagName + " had no src/href attribute")
    }
  }

  if (url) {
    fname = await filter_url(url, ele)
    Assert(fname != null && typeof fname === 'string')
    if (fname) {
      msg(fname)
      files.add(fname)
      return true
    }
  }
  return false
}
function filter_tag(ele) {
  let tn = ele.tagName.toLowerCase()
  return (!S.filter_tags.length) || (S.filter_tags.indexOf(tn) > -1)
}
async function filter_url(url, tag) {
  let ret = ""

  if (valid_host(url)) {
    let ext = urlext(url)
    if (valid_ext(ext)) {
      if (isdebug() && isverbose()) {
        vdbg("url:" + url + "\n  host:" + urlhost(url) + "\n  ext:" + urlext(url))
      }
      if (ext_isimg(ext) && (S.filter_img_size > 0)) {
        try {
          let sz = await get_img_size(url, tag)
          if (sz._width > S.filter_img_size && sz._height > S.filter_img_size) {
            ret = url
          }
        }
        catch (e) {
          err(e)
        }
      }
      else {
        ret = url
      }
    }
  }
  return ret
}
async function handle_message(m) {
  if (m) {
    let hdr = "Server: "
    vdbg(hdr + JSON.stringify(m))
    switch (m._msg) {
      case Msg.msg: msg(hdr + m._data); break;
      case Msg.err: err(hdr + m._data); break;
      case Msg.dbg: dbg(hdr + m._data); break;
      case Msg.saveAll: wrn(hdr + "Save/SaveAll shortcut is disabled"); break;
      case Msg.saveAllAs: wrn(hdr + "Save/SaveAll shortcut is disabled"); break;
      case Msg.inittab: break;
      default: err(hdr + "Invalid Message: " + JSON.stringify(m))
    }
  }
}
function save(fname, saveas) {
  if (saveas) {
    send("saveFileAs", fname)
  }
  else {
    send("saveFile", fname)
  }
}
function toggle_video_controls(altval) {
  //firefox bug - video controls take up whole video area so you can't select a video this way
  if (altval && !alt_down) {
    alt_down = true
    let vids = document.getElementsByTagName('video')
    for (let i = 0; i < vids.length; i++) {
      if (vids[i].hasAttribute("controls")) { // ok this worked
        vids[i].removeAttribute("controls")
      }
    }
  }
  else if (!altval && alt_down) {
    alt_down = false
    let vids = document.getElementsByTagName('video')
    for (let i = 0; i < vids.length; i++) {
      if (!vids[i].hasAttribute("controls")) { // ok this worked
        vids[i].setAttribute("controls", "controls")
      }
    }
  }
}

//=================================================================


init_script(() => {
  browser.runtime.onMessage.addListener(handle_message);

  send(Msg.inittab, '')

  window.onmousemove = (e) => {
    toggle_video_controls(e.altKey)
  }
  document.addEventListener('keydown', (e) => {
    toggle_video_controls(e.altKey)
  })
  document.addEventListener('keyup', (e) => {
    toggle_video_controls(e.altKey)
  })

  document.addEventListener('click', (e) => {
    if (e.altKey) {
      e.preventDefault()
      e.stopPropagation()
      let files = new Set()
      let ele = document.elementFromPoint(e.clientX, e.clientY)
      get_files(ele, files).then((elapsed) => {
        msg("Found " + files.size + " files in " + elapsed / 1000 + "s:")
        for (let f of files) {
          save(f, e.shiftKey)
        }
      }, (e) => {
        err(e)
      })

      return false
    }
    return true
  }, { passive: false, capture: true, useCapture: true })
})
