"use strict"

//========================================================================

const c_app_name = browser.runtime.getManifest().name
const c_app_version = browser.runtime.getManifest().version
const c_image_exts = ['.apng', '.gif', '.ico', '.cur', '.jpg', '.jpeg', '.jfif', '.pjpeg', '.pjp', '.svg']

//========================================================================

let _S = {
  debug: true,
  debug_verbose: false,
  debug_disable_download: false,    // only print dls to console 
  enable_global: true,              // if clicked item is not in filter_tags, save all items
  enable_thumbnail_detection: true, // search for <a> above <img> tags to prevent excessive loading of images
  max_concurrent_downloads: 10,
  thumb_search_depth: 1,            // # parents to search for <a> tag 
  query_timeout_ms: 120 * (1000),   // timeout for all Image.Load(s) and tree parse
  download_delay_ms: 0,             // 100 // prevent server flooding
  filter_img_size: 300,             // this can be slow
  filter_host: [],                  // save only URLs with these hosts/root
  filter_tags: ['a', 'video', 'img', 'audio'],//save contents of these tags
  filter_ext: ['.apng', '.gif', '.ico', '.cur', '.jpg', '.jpeg', '.jfif', '.pjpeg', '.pjp', '.svg',
    '.mp4', '.webm', '.ogg',
    '.flac', '.mpg', '.mpeg', '.m4v', '.mov', '.3gp', '.mp3'], //save files with these extensions
}
let S = null
async function load_settings() {
  msg("loading settings")
  S = await browser.storage.local.get()
  if (Object.keys(S).length === 0 && S.constructor === Object) {
    msg("initializing settings")
    S = JSON.parse(JSON.stringify(_S))
  }
  msg("settings=" + JSON.stringify(S))
}
async function save_settings() {
  msg("saving settings")
  let st = JSON.stringify(S)
  dbg("settings=" + st)
  await browser.storage.local.set(S)
}

//========================================================================

const Msg = {
  inittab: 'inittab',
  msg: 'msg',
  err: 'err',
  dbg: 'dbg',
  saveFile: 'saveFile',
  saveFileAs: 'saveFileAs',
  saveAll: 'saveAll',
  saveAllAs: 'saveAllAs',
};

//========================================================================

async function _init_script(fn) {
  await load_settings()
 
  let sn = ""
  if (document.currentScript != null) {
    sn = document.currentScript.src
  }
  else {
    sn = document.location
  }
  dbg("Initializing " + c_app_name + " (" + sn + ")")
  dbg("  strict mode: " + (isstrict() ? "on" : "off"))
  dbg("  debug: " + (isdebug() ? "on" : "off"))
  dbg("  verbose: " + (isverbose() ? "on" : "off"))
  fn()
}
function init_script(fn) {
  window.onload = async () => {
    try {
      await _init_script(fn)
    } catch (e) {
      err(e)
    }
  }
}

function isstrict() { return (function () { return !this; })() }
function isdebug() { return (S == null) || S.debug }
function isverbose() { return (S == null) || S.debug_verbose }
function msg(s) { console.log(s) }
function err(s) { console.error(s) }
function wrn(s) { console.warn(s) }
function dbg(s) { if (isdebug()) { console.debug(s); } }
function vdbg(s) { if (isdebug() && isverbose()) { console.debug(s); } }
function Raise(msg) {
  if (isdebug()) {
    console.error(msg)
    //debugger 
  }
  throw new Error(msg)
}
function Assert(x, msg = "") {
  if (!x) {
    let txt = "Assertion failed" + (msg ? ": " + msg : "")
    Raise(txt)
  }
}
function RPCError(e) { err(`${e}`) }
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
function urlext(url) {
  //https://regex101.com/
  let ret = ""
  let s = ("" + url)
  let r = /(\.[a-zA-Z0-9]+)([#\?]|$)/.exec(s)
  if (r && r.length > 1) {
    ret = r[1]
  }
  return ret
}
function urlhost(url) {
  let ret = ""
  let s = ("" + url)
  let r = /\/\/([^\/]+)/.exec(s)
  if (r && r.length > 1) {
    ret = r[1]
  }
  return ret
}
function ext_isimg(ext) {
  Assert(c_image_exts != null)
  return c_image_exts.indexOf(ext) > -1
}
function get_img_size(url, tag = null) {
  return new Promise((resolve, reject) => {
    if (tag && tag.complete) {
      resolve({ _width: tag.naturalWidth, _height: tag.naturalHeight })
    }
    else {
      let src = url
      let loadedimg = new Image()
      loadedimg.onload = () => {
        vdbg("" + url + " Loaded")
        resolve({ _width: loadedimg.naturalWidth, _height: loadedimg.naturalHeight })
      }
      loadedimg.onerror = reject
      loadedimg.src = src
    }
  })
}
function valid_ext(ext) {
  return (!S.filter_ext.length) || S.filter_ext.indexOf(ext) > -1
}
function valid_host(url) {
  let ret = false
  if (S.filter_host.length) {
    let h = urlhost(url)
    if (h) {
      ret = (S.filter_host.indexOf(h) > -1);
    }
    else if (("" + url).indexOf("javascript:") < 0) {
      err("Host not found in url '" + url + "' and not javascript:")
    }
  }
  else {
    ret = true
  }
  return ret
}
function tag_depth(tag, d = 0) {
  let res = 0
  if (!tag || tag.tagName.toLowerCase() === 'body') {
    res = d
  }
  else {
    res = tag_depth(tag.parentElement, d)
  }
  return res
}
function find_parent_tag(ele, name, maxdepth = 9999999, depth = 0) {
  if (ele != null) {
    let tn = ele.tagName.toLowerCase()
    if (tn === name) {
      return ele
    }
    if (depth < maxdepth) {
      let res = find_parent_tag(ele.parentElement, name, maxdepth, depth + 1)
      if (res != null) {
        return res
      }
    }
  }
  return null
}
