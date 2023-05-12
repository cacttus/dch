init_script(() => {
  msg("Settings window init")

  let g_cts = []

  function disable_setting(ctob) {
    let pname = ctob.name
    let ct = document.getElementById(pname)
    if (typeof pname === 'number') {
      ct.value = 0
    }
    else if (typeof pname === 'string') {
      ct.value = ""
    }
    else if (pname instanceof Array) {
      ct.value = ""
    }
    else {
      Raise("Invalid control type for disable")
    }
  }
  function make_ctrl(pname, pval) {
    let _type = ""
    let hasval = false
    let value = ""
    let checked = ""
    if (typeof pval === 'number') { _type = "number"; hasval = (pval > 0); value = 'value="' + pval + '"' }
    else if (typeof pval === 'boolean') { _type = "checkbox"; checked = (pval === true) ? 'checked' : ''; }
    else if (typeof pval === 'string') { _type = "text"; hasval = (pval.length > 0); value = 'value="' + pval + '"' }
    else if (pval instanceof Array) { _type = "text"; hasval = (pval.length > 0); value = 'value="' + pval + '"' }
    else {
      Raise("invalid prop type")
    }

    Assert(pname != null)

    let ctrl_ob = { name: '', dname: '', ctrl: null, dctrl: null, ctrl_text: '' }

    ctrl_ob.name = pname
    ctrl_ob.ctrl_text += '<label>' + pname + '</label>'
    ctrl_ob.ctrl_text += '<input id="' + pname + '" type="' + _type + '" ' + value + ' style="display:inline;width:auto;" ' + checked + '>'
    if (typeof pval !== 'boolean') {
      ctrl_ob.dname = pname + "_disable"
      ctrl_ob.ctrl_text += '<input id="' + ctrl_ob.dname + '" type="button" value="disable" style="padding-left:10;display:inline;width:auto;" ' + (hasval ? "" : "disabled") + '>'
    }
    ctrl_ob.ctrl_text += '<br/>'

    g_cts.push(ctrl_ob)
    return ctrl_ob
  }
  function update_disable_btn(ct) {
    let hasval = false
    if (ct.ctrl.type === 'text') { hasval = (ct.ctrl.value !== "") }
    else if (ct.ctrl.type === 'number') { hasval = (ct.ctrl.value > 0) }
    else {
      Raise("Invalid control type: " + ct.ctrl.getAttribute('type'))
    }
    if (hasval) {
      ct.dctrl.removeAttribute("disabled")
    }
    else {
      ct.dctrl.setAttribute('disabled', 'disabled')
    }
  }
  function update_controls() {
    g_cts = []

    let str_controls = ""
    for (let pname in S) {
      if (S.hasOwnProperty(pname)) {
        let pval = S[pname]
        dbg("prop=" + pname + " val=" + pval)
        str_controls += make_ctrl(pname, pval).ctrl_text
      }
    }
    dbg("controls=" + str_controls)

    document.getElementById("controls").innerHTML = str_controls

    for (let i = 0; i < g_cts.length; i++) {
      g_cts[i].ctrl = document.getElementById(g_cts[i].name)
      if (g_cts[i].dname) {
        g_cts[i].dctrl = document.getElementById(g_cts[i].dname)

        g_cts[i].ctrl.onchange = () => {
          update_disable_btn(g_cts[i])
        }
        g_cts[i].dctrl.onclick = () => {
          disable_setting(g_cts[i]);
          update_disable_btn(g_cts[i])
        }
      }
    }
  }
  function setmsg(txt) {
    document.getElementById('message').innerHTML = txt
    msg(txt)
  }
  document.getElementById("btnLoad").onclick = async () => {
    await load_settings();
    update_controls();
    setmsg('loaded')
  }
  document.getElementById("btnSave").onclick = async () => {
    try {
      for (let i = 0; i < g_cts.length; i++) {
        let ctrl = g_cts[i].ctrl
        let pname = g_cts[i].name
        vdbg("pname=" + pname + " ct[i]=" + JSON.stringify(g_cts[i]))
        let pval = S[pname]
        if (typeof pval === 'number') {
          let test_nu = parseFloat(pval);
          if (Number.isNaN(test_nu)) {
            Raise(pname + ": invalid number =" + pval + "")
          }
          S[pname] = parseInt(ctrl.value);
        }
        else if (typeof pval === 'boolean') {
          S[pname] = ctrl.checked;
        }
        else if (typeof pval === 'string') {
          S[pname] = ctrl.value;
        }
        else if (pval instanceof Array) {
          let arr = Array.from(ctrl.value.split(","));
          for (let i = arr.length - 1; i >= 0; i--) {
            arr[i] = arr[i].trim()
            if (arr[i].length === 0) {
              arr.splice(i, 1)
            }
          }
          S[pname] = arr
        }
        else {
          Raise(pname + ": invalid prop type: " + (typeof pval) + " S prop was " + (typeof S[pname]))
        }

        Assert((typeof S[pname]) === (typeof pval), "property '" + pname + "': type was not valid '" + (typeof S[pname]) + "' was " + (typeof S[pname]))
      }

      await save_settings();
      update_controls();
      setmsg('saved')
    } catch (e) {
      setmsg(e)
      throw e
    }
  }
  document.getElementById("btnDefault").onclick = async () => {
    S = JSON.parse(JSON.stringify(_S))
    vdbg("reset -> S =" + JSON.stringify(S))

    await save_settings()
    await load_settings()
    update_controls();
    setmsg('reset')
  }
  document.getElementById("message").onclick += () => {
    setmsg("&nbsp;")
  }
  update_controls();
})
