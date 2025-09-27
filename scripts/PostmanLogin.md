       if (pm.response.code === 200) {
              const responseBody = pm.response.json();
              if (responseBody.token) {
                pm.globals.set("bearerToken", responseBody.token);
                console.log("Bearer token saved:", responseBody.token);
              } else {
                console.error("Token not found in the response.");
              }
            } else {
              console.error("Login failed with status code:", pm.response.code);
            }