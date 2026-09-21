package com.example.a2th

import org.junit.Test

import org.junit.Assert.*

/**
 * Example local unit test, which will execute on the development machine (host).
 *
 * See [testing documentation](http://d.android.com/tools/testing).
 */
class ExampleUnitTest {
    @Test
    fun addition_isCorrect() {
        assertEquals(4, 2 + 2)

        var myAge = 20 //var - 가변 val - 불변
        myAge = 26

        println("나이 : $myAge")
        println("진짜나이 : " + myAge)

        val myName = "홍길동"
        val age: Int = 25
        println("코틀린 : 불변변수 val " + "나의 이름은 " + myName)

        var numOne = 1
        var numTwo = 30000000
        var myByte: Byte = 1
        var myInt: Int = 20
        var myLong: Long = 25L
        println("numOne : " + numOne)
        println("numTwo : " + numTwo)
        println("myByte : " + myByte)
        println("myInt : " + myInt)
        println("myLong : " + myLong)

        var myFloat: Float = 30.2F
        var myDouble: Double = 35.4
        println("실수 자료형 Float : " + myFloat)
        println("실수 자료형 Double : " + myDouble)

        var myBoolean: Boolean = true
        println("부울린 자료형 Boolean : " + myBoolean)

        var myChar1: Char = 'K'
        var myChar2: Char = 'o'
        var myChar3: Char = 't'
        var myChar4: Char = 'l'
        var myChar5: Char = 'i'
        var myChar6: Char = 'n'
        println("문자 자료형 Char : " + myChar1 + myChar2 + myChar3 + myChar4 + myChar5 + myChar6)

        var myString1: String = "Kotlin\n"
        var myString2: String = "Java"
        println("문자열 자료형 String : " + myString1)
        println("문자열 자료형 String : " + myString2)

        var myArray: IntArray = intArrayOf(1,2,3,4,5)
        println("배열 자료형 - 배열의 3번째 값 : " + myArray[2])
    }
}