describe("Global Failure Recovery Simulation", () => {
    it("Case 1: Node2 fails during replication to Node1", () => {
        cy.visitNode(nodes.n2);
        cy.simulateCrash();
        cy.writeRow(4, "pending_write");

        cy.visitNode(nodes.n1);
        cy.readRow(4);

        cy.logShouldContain("WRITE FAILED - WILL RETRY");
    });

    it("Case 2: Node1 recovers and receives missed writes", () => {
        cy.visitNode(nodes.n1);
        cy.simulateRecover();

        cy.readRow(4);
        cy.logShouldContain("pending_write");
    });

    it("Case 3: Node1 fails replicating to Node2", () => {
        cy.visitNode(nodes.n2);
        cy.simulateCrash();

        cy.visitNode(nodes.n1);
        cy.writeRow(5, "central_write");

        cy.logShouldContain("RETRY QUEUED");
    });

    it("Case 4: Node2 recovers and gets missed writes", () => {
        cy.visitNode(nodes.n2);
        cy.simulateRecover();

        cy.readRow(5);
        cy.logShouldContain("central_write");
    });
});