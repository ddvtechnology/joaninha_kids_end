/*
  # Adiciona categoria OUTROS aos produtos

  1. Alterações
    - Adiciona 'OUTROS' como nova opção no enum product_category

  2. Notas
    - Não é possível remover ou modificar valores existentes em um enum
    - Apenas adicionando novo valor
*/

ALTER TYPE product_category ADD VALUE 'OUTROS';