const nodes = {
    n1: "https://team-node1.ccs-cloud.com",
    n2: "https://team-node2.ccs-cloud.com",
    n3: "https://team-node3.ccs-cloud.com",
};

const levels = ["read uncommitted", "read committed", "repeatable read", "serializable"];

describe("Global Concurrency Control Tests", () => {
    levels.forEach((level) => {
        describe(`Testing on isolation level: ${level}`, () => {
            it("Case 1: Concurrent READ-READ", () => {
            cy.visitNode(nodes.n1);
            cy.setIsolation(level);
            cy.readRow(1);

            cy.visitNode(nodes.n2);
            cy.setIsolation(level);
            cy.readRow(1);

            cy.logShouldContain("READ OK");
            });

            it("Case 2: Concurrent WRITE (Node2) + READ (Node1)", () => {
            cy.visitNode(nodes.n2);
            cy.setIsolation(level);
            cy.writeRow(1, "value_from_node2");

            cy.visitNode(nodes.n1);
            cy.setIsolation(level);
            cy.readRow(1);

            cy.logShouldContain("value_from_node2");
            });

            it("Case 3: WRITE-WRITE conflict", () => {
            cy.visitNode(nodes.n2);
            cy.setIsolation(level);
            cy.writeRow(1, "v2");

            cy.visitNode(nodes.n3);
            cy.setIsolation(level);
            cy.writeRow(1, "v3");

            cy.logShouldContain("CONFLICT DETECTED")
            });
        });
    });
});