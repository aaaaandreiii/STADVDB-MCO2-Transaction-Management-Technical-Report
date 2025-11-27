Promise.all([
    axios.get("http://localhost:3001/trans/read/100", { params: { isolation: "READ UNCOMMITTED" }}),
    axios.post("http://localhost:3002/trans/update", { trans_id: 100, amount: 500, isolation: "READ UNCOMMITTED" })
]);
