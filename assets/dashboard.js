document.addEventListener("DOMContentLoaded", async () => {
    // 1. Verificação de Segurança (Proteção de Rota)
    const userData = JSON.parse(localStorage.getItem("fitUser"));

    if (!userData) {
        // Se não tá logado, tchau!
        window.location.href = "index.html";
        return;
    }

    // Opcional: Se quiser que APENAS o admin veja essa tela
    if (userData.workoutType !== "admin_dashboard") {
         alert("Acesso restrito a administradores.");
         window.location.href = "index.html"; // Ou redirecionar para painel de aluno
         return;
    }

    // 2. Preencher dados da tela com o usuário logado
    document.getElementById("adminName").innerText = userData.name.split(" ")[0];

    // 3. Logout
    document.getElementById("logoutBtn").addEventListener("click", () => {
        localStorage.removeItem("fitUser");
        window.location.href = "index.html";
    });

    // 4. Carregar a lista de usuários para a tabela
    try {
        // Nota: Como estamos no dashboard.html (raiz), o caminho para o json é 'user/users.json'
        const response = await fetch('user/users.json');
        const users = await response.json();

        // Atualiza Card de Total
        document.getElementById("totalUsers").innerText = users.length;

        const tableBody = document.getElementById("userTableBody");
        tableBody.innerHTML = ""; // Limpa antes de preencher

        users.forEach(user => {
            // Define o estilo do badge (Admin ou Ativo)
            const isAdm = user.workoutType === 'admin_dashboard';
            const statusClass = isAdm ? 'status-admin' : 'status-active';
            const statusText = isAdm ? 'ADMIN' : 'ATIVO';

            const row = `
                <tr>
                    <td style="display: flex; align-items: center; gap: 10px;">
                        <img src="${user.avatar || 'https://ui-avatars.com/api/?name=User'}" style="width: 30px; border-radius: 50%;">
                        ${user.name}
                    </td>
                    <td>${user.email}</td>
                    <td>${user.workoutType.replace('_', ' ').toUpperCase()}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>
                        <button style="background:none; border:none; color:white; cursor:pointer;">
                            <i class="ph ph-pencil-simple"></i>
                        </button>
                    </td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });

    } catch (error) {
        console.error("Erro ao carregar lista:", error);
    }
});