sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/BusyIndicator",
	"sap/m/MessageToast"
  ], function (Controller, JSONModel, BusyIndicator, MessageToast) {
	"use strict";
  
	function mdToHtml(s) {
	  return (s || "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;").replace(/>/g, "&gt;")
		.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
		.replace(/\n\n/g, "<br/><br/>")
		.replace(/\n/g, "<br/>");
	}
  
	return Controller.extend("prototypejoyit.controller.Main", {
	  onInit: function () {
		this.getView().setModel(new JSONModel({
		  messages: [{
			role: "assistant",
			contentHtml: mdToHtml("Hello! I’m your **SAP Audit Copilot**. Ask me anything about audits, deviations, and compliance."),
			isTyping: false
		  }]
		}));
	  },
  
	  onUseSuggestion: function (oEvent) {
		const sPrompt = oEvent.getSource().data("prompt");
		this.byId("input").setValue(sPrompt);
		this.onSend();
	  },
  
	  onLiveChange: function () {},
  
	  onSend: async function () {
		const oModel = this.getView().getModel();
		const aMsgs = oModel.getProperty("/messages");
		const oInput = this.byId("input");
		const oBtn = this.byId("sendBtn");
		const sQ = (oInput.getValue() || "").trim();
  
		if (!sQ) { MessageToast.show("Type a question or pick a suggestion."); return; }
  
		aMsgs.push({ role: "user", contentHtml: mdToHtml(sQ), isTyping: false });
		oModel.updateBindings(true); this._scrollToBottom();
  
		const typingIdx = aMsgs.push({ role: "assistant", contentHtml: "", isTyping: true }) - 1;
		oModel.updateBindings(true); this._scrollToBottom();
  
		oInput.setEnabled(false); oBtn.setBusy(true); BusyIndicator.show(0);
  
		try {
		  const res = await fetch("http://localhost:3001/api/llm", {
			method: "POST", headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ question: sQ })
		  });
		  let sAns = res.ok ? (await res.json()).answer || "(no answer)" : `**Error**: ${await res.text()}`;
		  aMsgs[typingIdx] = { role: "assistant", contentHtml: mdToHtml(sAns), isTyping: false };
		  oModel.updateBindings(true); this._scrollToBottom();
		} catch (e) {
		  aMsgs[typingIdx] = { role: "assistant", contentHtml: mdToHtml("**Network error** while calling the LLM."), isTyping: false };
		  oModel.updateBindings(true);
		} finally {
		  oInput.setEnabled(true); oBtn.setBusy(false); BusyIndicator.hide();
		  oInput.setValue(""); this._scrollToBottom();
		}
	  },
  
	  _scrollToBottom: function () {
		const sc = this.byId("chatScroll");
		setTimeout(() => {
		  const dom = sc.getDomRef();
		  if (dom) dom.scrollTop = dom.scrollHeight;
		}, 0);
	  }
	});
  });
  