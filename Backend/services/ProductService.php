<?php

declare(strict_types=1);

final class ProductService
{
    public function __construct(
        private Product $product
    ) {
    }

    public function list(array $filters): array
    {
        return $this->product->list($filters);
    }

    public function get(int $id): array
    {
        $product = $this->product->find($id);

        if (!$product) {
            throw new RuntimeException('Product not found.');
        }

        return $product;
    }

    public function create(array $data): array
    {
        $existing = $this->product->findBySku($data['sku']);

        if ($existing) {
            throw new DomainException(
                'A product with this SKU already exists.'
            );
        }

        $id = $this->product->create($data);

        return $this->product->find($id);
    }

    public function update(int $id, array $data): array
    {
        $existingProduct = $this->product->find($id);

        if (!$existingProduct) {
            throw new RuntimeException('Product not found.');
        }

        $existingSku = $this->product->findBySku($data['sku']);

        if (
            $existingSku &&
            (int) $existingSku['id'] !== $id
        ) {
            throw new DomainException(
                'A product with this SKU already exists.'
            );
        }

        $this->product->update($id, $data);

        return $this->product->find($id);
    }

    public function delete(int $id): void
    {
        $product = $this->product->find($id);

        if (!$product) {
            throw new RuntimeException('Product not found.');
        }

        $this->product->delete($id);
    }

    public function statistics(): array
    {
        return $this->product->statistics();
    }
}
