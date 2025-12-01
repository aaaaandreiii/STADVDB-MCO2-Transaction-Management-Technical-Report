const NODE1 = "http://ccscloud.dlsu.edu.ph:60115/";
const NODE2 = "http://ccscloud.dlsu.edu.ph:60116/";
const NODE3 = "http://ccscloud.dlsu.edu.ph:60117/";

const ISOLATION_LEVELS = [
    "READ UNCOMMITTED",
    "READ COMMITTED",
    "REPEATABLE READ",
    "SERIALIZABLE"
];

describe("MCO2 Distributed Database Concurrency and Recovery", () => {
    ISOLATION_LEVELS.forEach(level => {
        describe(`=== Isolation Level: ${level} ===`, () => {
            // CASE 1: Concurrent Reads
            it("Case 1: Concurrent Reads on same item", () => {
                cy.log("Testing concurrent READS...");

                // cy.visit(NODE1 + '/concurrency')
                cy.visit(NODE1)
                cy.contains('a', 'Concurrency Demo').click();
                // cy.get('#txA-node').select('Node 2 (fragment)');
                // cy.get('#txA-iso').select(`${level}`);
                // cy.request({
                //     method: 'POST',
                //     url: `${NODE1}api/tx/start`,
                //     headers: {
                //         'Content-Type': 'application/json',
                //         'Referer': `${NODE1}/concurrency/`
                //     },
                //     body: {
                //         node: 2,
                //         isolation: level
                //     }
                // }).then((res) => {
                //     expect(res.status).to.eq(200);
                // });

                // cy.wait(15)
                cy.contains('button', 'Start Tx A').click();
                cy.contains('button', 'READ').click();
                // select node
                // select isolation level
                // start trans
                // read

                cy.visit(NODE2)
                // select node
                // select isolation levels
                // start trans
                // read

                // repeat 4 times
            });

            // CASE 2: Write + Read
            // it("Case 2: Write on one node, Read on others", () => {
            //     cy.log("Testing Write + Read...");

            //     cy.visit(NODE1)
            //     // select node
            //     // select isolation level
            //     // start trans
            //     // update

            //     cy.visit(NODE2)
            //     // select node
            //     // select isolation levels
            //     // start trans
            //     // read

            //     cy.visit(NODE3)
            //     // select node
            //     // select isolation levels
            //     // start trans
            //     // read

            //     // repeat 4 times
            // });

            // // CASE 3: Concurrent Writes
            // it("Case 3: Concurrent Writes (Node2 vs Node3)", () => {
            //     cy.log("Testing concurrent WRITES...");

            //     cy.visit(NODE2)
            //     // select node
            //     // select isolation level
            //     // start trans
            //     // update

            //     cy.visit(NODE3)
            //     // select node
            //     // select isolation level
            //     // start trans
            //     // update

            //     // repeat 4 times
            // });
        });
    });

    // STEP 4: FAILURE RECOVERY CASES
    // describe("=== FAILURE RECOVERY TESTS ===", () => {

    //     // CASE 1: Node1 fails during replication
    //     it("Case 1: Node 1 fails during replication", () => {
    //         cy.log("Testing: Node1 down while Node2 writes.");
    //     });

    //     // CASE 2: Node1 recovers after missing updates
    //     it("Case 2: Node1 recovers and gets missed writes", () => {
    //     });

    //     // CASE 3: Node2 fails during replication from Node1
    //     it("Case 3: Node2 fails during central-node replication", () => {
    //     });

    //     // CASE 4: Node3 misses writes and recovers later
    //     it("Case 4: Node3 recovers and receives missed writes", () => {
    //     });

    // });

    // // ================================================================
    // // TRANSPARENCY TEST
    // // ================================================================

    // it("Data Transparency: user should not know which node served the data", () => {
    //     cy.request(`${NODE1}/api/query?id=101`).then(res => {
    //     expect(res.body).to.have.keys("id", "amount", "name");
    //     expect(res.body.node).to.not.exist;
    //     });
    // });
});