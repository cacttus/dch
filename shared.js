"use strict"

//========================================================================

const c_app_name = browser.runtime.getManifest().name
const c_image_exts = ['.apng', '.gif', '.ico', '.cur', '.jpg', '.jpeg', '.jfif', '.pjpeg', '.pjp', '.svg']

//========================================================================
// settings

let S = {
  debug: true,
  debug_verbose: false,
  debug_disable_download: false, //only print dls to console 
  allow_global: true, // if clicked item is not in filter_tags, save all items
  thumb_search_enable: true, // search for <a> above <img> tags to prevent excessive loading of images
  max_concurrent_downloads: 10,
  thumb_search_depth: 1,
  filter_img_size: 300, // this can be slow
  //filter_host: ['media.host.com'], //save only URLs with these hosts/root
  filter_tags: ['a', 'video', 'img', 'audio'], //save contents of these tags
  filter_ext: ['.apng', '.gif', '.ico', '.cur', '.jpg', '.jpeg', '.jfif', '.pjpeg', '.pjp', '.svg',
    '.mp4', '.webm', '.ogg',
    '.flac', '.mpg', '.mpeg', '.m4v', '.mov', '.3gp', '.mp3'], //save files with these extensions
  query_timeout_ms: 120 * (1000), // timeout for all Image.Load(s) and tree parse
  download_delay_ms: 0, //100 // prevent server flooding
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

function init_script(fn) {
  try {
    let sn = ""
    if (document.currentScript != null) {
      sn = document.currentScript.src
    }
    else {
      sn = document.location
    }
    dbg("Initializing " + c_app_name + " (" + sn + ")")
    dbg("  strict mode: " + (isstrict() ? "on" : "off"))

    //check config
    let suff = ", no files will be added (to disable comment out or set null)"
    if (S.filter_ext != null && S.filter_ext.length === 0) {
      wrn("Filter extensions was empty" + suff)
    }
    if (S.filter_host != null && S.filter_host.length === 0) {
      wrn("Filter hosts was empty" + suff)
    }
    if (S.filter_tags != null && S.filter_tags <= 0) {
      wrn("Filter tags was empty" + suff)
    }
    if (S.filter_img_size != null && S.filter_img_size <= 0) {
      wrn("Filter imge size was <=0" + suff)
    }

    window.onload = () => {
      try {
        fn()
      } catch (e) {
        err(e)
      }
    }
  } catch (e) {
    err(e)
  }
}
function isstrict() { return (function () { return !this; })() }
function isdebug() { return S.debug != null && S.debug }
function isverbose() { return S.debug_verbose != null && S.debug_verbose }
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
    let aa = arguments.callee.toString().match(/\(.*?\)/)[0];
    console.log("aa=" + aa)

    let txt = "Assertion failed '" + Object.keys(x) + "'" + msg ? ": " + msg : ""
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
  return (S.filter_ext == null) || S.filter_ext.indexOf(ext) > -1
}
function valid_host(url) {
  let ret = false
  if (S.filter_host != null) {
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
