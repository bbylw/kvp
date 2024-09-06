document.addEventListener('DOMContentLoaded', function() {
  fetchLinks();

  document.getElementById('link-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const formData = new FormData(this);
    const linkData = Object.fromEntries(formData);
    
    const response = await fetch('/api/links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(linkData),
    });

    if (response.ok) {
      alert('链接已保存');
      fetchLinks();
      this.reset();
    } else {
      alert('保存失败');
    }
  });

  document.getElementById('toggle-edit').addEventListener('click', function() {
    const editForm = document.getElementById('edit-form');
    editForm.style.display = editForm.style.display === 'none' ? 'block' : 'none';
  });
});

async function fetchLinks() {
  const response = await fetch('/api/links');
  const links = await response.json();
  renderLinks(links);
}

function renderLinks(links) {
  document.querySelectorAll('.link-grid').forEach(grid => grid.innerHTML = '');

  const linksByCategory = groupBy(links, 'category');
  for (const [category, categoryLinks] of Object.entries(linksByCategory)) {
    const section = document.querySelector(`#${category} .link-grid`);
    if (section) {
      categoryLinks.forEach(link => {
        const linkCard = createLinkCard(link);
        section.appendChild(linkCard);
      });
    }
  }
}

function createLinkCard(link) {
  const div = document.createElement('div');
  div.className = 'link-card';
  div.setAttribute('href', link.url);
  div.innerHTML = `
    <i class="${link.icon}"></i>
    <h3>${link.title}</h3>
  `;
  div.addEventListener('click', function() {
    window.open(link.url, '_blank');
  });
  return div;
}

function groupBy(array, key) {
  return array.reduce((result, currentValue) => {
    (result[currentValue[key]] = result[currentValue[key]] || []).push(currentValue);
    return result;
  }, {});
}
