Cypress.Commands.add("visitNode", (nodeUrl) => {
    cy.visit(nodeUrl);
});

Cypress.Commands.add("setIsolation", (level) => {
    cy.get("#isolation-select").select(level);
});

Cypress.Commands.add("readRow", (rowId) => {
    cy.get("#row-id").clear().type(rowId);
    cy.get("#btn-read").click();
});

Cypress.Commands.add("writeRow", (rowId, value) => {
    cy.get("#row-id").clear().type(rowId);
    cy.get("#write-value").clear().type(value);
    cy.get("#btn-write").click();
});

Cypress.Commands.add("logShouldContain", (text) => {
    cy.get("#log-output").should("contain.text", text);
});

Cypress.Commands.add("simulateCrash", () => {
    cy.get("#btn-crash").click();
});

Cypress.Commands.add("simulateRecover", () => {
    cy.get("#btn-recover").click();
});