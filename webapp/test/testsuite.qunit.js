sap.ui.define(function () {
	"use strict";

	return {
		name: "QUnit test suite for the UI5 Application: prototypejoyit",
		defaults: {
			page: "ui5://test-resources/prototypejoyit/Test.qunit.html?testsuite={suite}&test={name}",
			qunit: {
				version: 2
			},
			sinon: {
				version: 1
			},
			ui5: {
				language: "EN",
				theme: "sap_horizon"
			},
			coverage: {
				only: "prototypejoyit/",
				never: "test-resources/prototypejoyit/"
			},
			loader: {
				paths: {
					"prototypejoyit": "../"
				}
			}
		},
		tests: {
			"unit/unitTests": {
				title: "Unit tests for prototypejoyit"
			},
			"integration/opaTests": {
				title: "Integration tests for prototypejoyit"
			}
		}
	};
});
