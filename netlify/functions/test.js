exports.handler = async function(event, context) {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'JS function works' }),
    headers: {
      'Content-Type': 'application/json'
    }
  };
};
