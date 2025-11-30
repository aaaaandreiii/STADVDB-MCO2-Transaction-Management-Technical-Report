describe("Replication Tests", () => {
    it("Node2 → Node1 replication", () => {
        cy.visitNode(nodes.n2);
        cy.writeRow(2, "node2_update");
        
        cy.visitNode(nodes.n1);
        cy.readRow(2);

        cy.logShouldContain("node2_update");
    });

    it("Node1 → Node2/Node3 replication", () => {
        cy.visitNode(nodes.n1);
        cy.writeRow(3, "central_update");

        cy.visitNode(nodes.n2);
        cy.readRow(3);
        cy.logShouldContain("central_update");

        cy.visitNode(nodes.n3);
        cy.readRow(3);
        cy.logShouldContain("central_update");
    });
});
