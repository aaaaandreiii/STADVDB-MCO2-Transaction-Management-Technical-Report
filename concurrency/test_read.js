Promise.all([
    axios.get("http://localhost:3001/trans/read/100", { params: { isolation: "READ COMMITTED" }}),
    axios.get("http://localhost:3002/trans/read/100", { params: { isolation: "READ COMMITTED" }})
])
.then(res => console.log(res));
