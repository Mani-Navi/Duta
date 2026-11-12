package com.NewsGrid.V10.repository;

import com.NewsGrid.V10.entity.PushSubscription;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, Long> {

    Optional<PushSubscription> findByEndpoint(String endpoint);

    List<PushSubscription> findByUserId(Long userId);

    @Transactional
    void deleteByUserIdAndEndpoint(Long userId, String endpoint);

    @Transactional
    void deleteByUserId(Long userId);
}